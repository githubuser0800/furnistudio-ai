import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDIT_CREDIT_COST = 0.5;

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

    // Check credits (0.5 per edit, stored as integer so check >= 1)
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const messageContent = [
      {
        type: "text",
        text: `EDIT THIS IMAGE. Keep the furniture product EXACTLY as is - same shape, color, materials, texture, position. Do NOT alter the furniture piece in any way. Only modify: ${edit_instruction}. Maintain photorealistic quality throughout.`,
      },
      {
        type: "image_url",
        image_url: { url: `data:${genMime};base64,${base64Gen}` },
      },
      ...productParts,
    ];

    console.log("Edit request | job:", job_id, "| instruction:", edit_instruction);

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: messageContent }],
          modalities: ["image", "text"],
          temperature: 0.3,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service rate limited. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI editing failed");
    }

    const aiResult = await aiResponse.json();

    // Extract generated image
    let generatedBase64: string | null = null;
    let generatedMimeType = "image/png";

    const message = aiResult.choices?.[0]?.message;

    const images = message?.images;
    if (Array.isArray(images) && images.length > 0) {
      const imgUrl = images[0]?.image_url?.url;
      if (imgUrl) {
        const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          generatedMimeType = match[1];
          generatedBase64 = match[2];
        }
      }
    }

    const content = message?.content;
    if (!generatedBase64 && Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            generatedMimeType = match[1];
            generatedBase64 = match[2];
            break;
          }
        }
      }
    }

    if (!generatedBase64 && typeof content === "string") {
      const match = content.match(/data:([^;]+);base64,([A-Za-z0-9+/=\s]+)/s);
      if (match) {
        generatedMimeType = match[1];
        generatedBase64 = match[2].replace(/\s/g, "");
      }
    }

    if (!generatedBase64) {
      console.error("No image in AI response:", JSON.stringify(aiResult).substring(0, 1000));
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

    // Deduct 0.5 credits (round down to integer)
    const newCredits = Math.max(0, profile.credits_remaining - 1);
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
