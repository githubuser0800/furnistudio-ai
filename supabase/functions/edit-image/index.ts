import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDIT_CREDIT_COST = 1;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const {
      job_id,           // The job whose output we're editing
      edit_instruction, // What to change
      original_image_id, // Original product image for preservation reference
    } = await req.json();

    if (!job_id || !edit_instruction) {
      throw new Error("Missing job_id or edit_instruction");
    }

    if (typeof edit_instruction !== "string" || edit_instruction.length > 2000) {
      throw new Error("edit_instruction must be a string under 2000 characters");
    }

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.credits_remaining < 1) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", credits_remaining: profile?.credits_remaining || 0 }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the job's output image (the image to edit)
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (!job?.output_url) throw new Error("Job or output not found");

    // Download the generated image to edit
    const { data: genData, error: genErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .download(job.output_url);

    if (genErr || !genData) throw new Error("Failed to download generated image");

    const genBytes = new Uint8Array(await genData.arrayBuffer());
    const base64Gen = base64Encode(genBytes);
    const genMime = job.output_url.endsWith(".png") ? "image/png" : "image/jpeg";

    // Optionally download original product image for preservation reference
    let productParts: Array<Record<string, unknown>> = [];
    if (original_image_id) {
      const { data: imgRecord } = await supabaseAdmin
        .from("images")
        .select("original_url, filename")
        .eq("id", original_image_id)
        .eq("user_id", user.id)
        .single();

      if (imgRecord?.original_url) {
        const { data: prodData } = await supabaseAdmin.storage
          .from("furniture-images")
          .download(imgRecord.original_url);

        if (prodData) {
          const prodBytes = new Uint8Array(await prodData.arrayBuffer());
          const base64Prod = base64Encode(prodBytes);
          const prodMime = imgRecord.filename?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
          productParts = [
            {
              type: "text",
              text: "PRODUCT REFERENCE: This is the original furniture product. Keep it EXACTLY as is - same shape, color, materials, position. Only modify the environment as instructed.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${prodMime};base64,${base64Prod}` },
            },
          ];
        }
      }
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Build Gemini parts — product reference FIRST for strongest anchoring
    const geminiParts: Array<Record<string, unknown>> = [];

    // 1. Add product reference image first if available (anchors the model)
    if (productParts.length > 0) {
      const prodPart = productParts.find((p: any) => p.type === "image_url");
      if (prodPart) {
        const prodUrl = (prodPart as any).image_url?.url as string;
        const prodMatch = prodUrl?.match(/^data:([^;]+);base64,(.+)$/s);
        if (prodMatch) {
          geminiParts.push({
            text: [
              "PRODUCT REFERENCE IMAGE (DO NOT ALTER THIS PRODUCT):",
              "Study this original product photograph carefully. Every detail must be preserved exactly:",
              "- Exact silhouette, proportions, and dimensions",
              "- All materials, textures, and surface finishes (fabric weave, wood grain, metal brushing)",
              "- Precise colors, tones, and any color gradients or patina",
              "- Hardware, stitching, buttons, legs, arms — every component",
              "- The way light interacts with surfaces (e.g., velvet absorbs light, leather reflects)",
              "This product must appear IDENTICAL in the edited output.",
            ].join("\n"),
          });
          geminiParts.push({
            inlineData: { mimeType: prodMatch[1], data: prodMatch[2] },
          });
        }
      }
    }

    // 2. Add the current staged image to edit
    geminiParts.push({
      text: [
        "IMAGE TO EDIT (modify ONLY the environment, NEVER the product):",
        "This is the current staged photograph. The furniture product in this image must remain pixel-perfect — same position, angle, scale, shape, color, material, texture, and every visible detail.",
        "",
        `EDIT INSTRUCTIONS: ${edit_instruction}`,
        "",
        "STRICT RULES:",
        "1. The furniture product must be IDENTICAL to the product reference — do not redraw, reshape, recolor, or reinterpret it in any way.",
        "2. Only modify the surrounding environment (walls, floor, lighting, props, background) as instructed.",
        "3. Maintain physically accurate shadows and reflections consistent with the product's position.",
        "4. Keep photorealistic quality — subtle lens imperfections, natural lighting falloff, realistic material behavior.",
        "5. If the edit instruction conflicts with product preservation, ALWAYS prioritize keeping the product unchanged.",
      ].join("\n"),
    });
    geminiParts.push({
      inlineData: { mimeType: genMime, data: base64Gen },
    });

    console.log("Edit request | job:", job_id, "| instruction:", edit_instruction);

    const candidateModels = [
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-image-preview",
      "gemini-2.0-flash-preview-image-generation",
      "gemini-2.5-flash",
    ];

    let aiResponse: Response | null = null;
    let usedModel: string | null = null;
    let aiErrorStatus = 500;
    let aiErrorText = "No response from AI provider";

    for (const geminiModel of candidateModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: geminiParts }],
            generationConfig: {
              temperature: 0.3,
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      if (response.ok) {
        aiResponse = response;
        usedModel = geminiModel;
        break;
      }

      const errText = await response.text();
      aiErrorStatus = response.status;
      aiErrorText = errText;

      if (response.status === 404 && /not found|not supported/i.test(errText)) {
        console.warn(`Gemini model unavailable: ${geminiModel}. Trying fallback.`);
        continue;
      }
      break;
    }

    if (!aiResponse) {
      console.error("Gemini API error:", aiErrorStatus, aiErrorText);
      if (aiErrorStatus === 429) {
        return new Response(
          JSON.stringify({ error: "AI service rate limited. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI editing failed: " + aiErrorText.substring(0, 200));
    }

    console.log("Gemini model used for edit:", usedModel);

    const aiResult = await aiResponse.json();

    // Extract generated image from Gemini native response
    let generatedBase64: string | null = null;
    let generatedMimeType = "image/png";

    const candidateParts = aiResult.candidates?.[0]?.content?.parts;
    if (Array.isArray(candidateParts)) {
      for (const part of candidateParts) {
        if (part.inlineData?.data) {
          generatedBase64 = part.inlineData.data;
          generatedMimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
    }

    if (!generatedBase64) {
      console.error("No image in Gemini response:", JSON.stringify(aiResult).substring(0, 1000));
      throw new Error("AI did not return an image. Please try again.");
    }

    // Upload edited image
    const ext = generatedMimeType.includes("png") ? "png" : "jpg";
    const editPath = `${user.id}/edits/${job_id}_${Date.now()}.${ext}`;

    const binaryString = atob(generatedBase64);
    const outputBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      outputBytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .upload(editPath, outputBytes, { contentType: generatedMimeType });

    if (uploadErr) throw new Error("Failed to store edited image");

    // Deduct credits
    const newCredits = Math.max(0, profile.credits_remaining - EDIT_CREDIT_COST);
    await supabaseAdmin
      .from("profiles")
      .update({ credits_remaining: newCredits })
      .eq("id", user.id);

    // Get signed URL
    const { data: signedUrl } = await supabaseAdmin.storage
      .from("furniture-images")
      .createSignedUrl(editPath, 3600);

    console.log("Edit complete | job:", job_id, "| output:", editPath);

    return new Response(
      JSON.stringify({
        success: true,
        output_url: signedUrl?.signedUrl || null,
        output_path: editPath,
        credits_remaining: newCredits,
        edit_instruction,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("edit-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
