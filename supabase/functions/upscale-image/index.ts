import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { image_path, scale, sharpen, reduce_noise } = await req.json();

    if (!image_path || !scale) {
      throw new Error("Missing image_path or scale");
    }

    if (scale !== "2x" && scale !== "4x") {
      throw new Error("Invalid scale. Must be '2x' or '4x'");
    }

    const creditCost = 1;

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.credits_remaining < creditCost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", credits_remaining: profile?.credits_remaining || 0 }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the image
    const { data: imgData, error: dlErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .download(image_path);

    if (dlErr || !imgData) throw new Error("Failed to download image");

    const imgBytes = new Uint8Array(await imgData.arrayBuffer());
    const base64Img = base64Encode(imgBytes);
    const mime = image_path.endsWith(".png") ? "image/png" : "image/jpeg";

    const targetRes = scale === "4x" ? "16384" : "8192";
    
    let enhancementInstructions = "";
    if (sharpen) enhancementInstructions += " Enhance sharpness and fine details - fabric textures, wood grain, stitching, and material surfaces should be crisp and well-defined.";
    if (reduce_noise) enhancementInstructions += " Remove any noise, grain, or compression artifacts. Produce a clean, smooth result.";

    const prompt = `Upscale this furniture product image to the highest possible resolution (target: ${targetRes}px on the longest edge). Preserve ALL furniture details exactly - same shape, color, materials, texture, position. Maintain photorealistic quality.${enhancementInstructions} Do not alter or regenerate the furniture piece. Ultra high resolution output.`;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    console.log("Upscale request | scale:", scale, "| path:", image_path);

    const geminiModel = "gemini-2.0-flash-exp";
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mime, data: base64Img } },
            ],
          }],
          generationConfig: {
            temperature: 0.3,
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service rate limited. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI upscaling failed: " + errText.substring(0, 200));
    }

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
      throw new Error("AI did not return an upscaled image. Please try again.");
    }

    // Upload upscaled image
    const ext = generatedMimeType.includes("png") ? "png" : "jpg";
    const scaleLabel = scale === "4x" ? "16K" : "8K";
    const upscalePath = `${user.id}/upscaled/${Date.now()}_${scaleLabel}.${ext}`;

    const binaryString = atob(generatedBase64);
    const outputBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      outputBytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .upload(upscalePath, outputBytes, { contentType: generatedMimeType });

    if (uploadErr) throw new Error("Failed to store upscaled image");

    // Deduct credits
    const newCredits = Math.max(0, profile.credits_remaining - creditCost);
    await supabaseAdmin
      .from("profiles")
      .update({ credits_remaining: newCredits })
      .eq("id", user.id);

    // Get signed URL
    const { data: signedUrl } = await supabaseAdmin.storage
      .from("furniture-images")
      .createSignedUrl(upscalePath, 3600);

    console.log("Upscale complete | scale:", scale, "| output:", upscalePath);

    return new Response(
      JSON.stringify({
        success: true,
        output_url: signedUrl?.signedUrl || null,
        output_path: upscalePath,
        credits_remaining: newCredits,
        scale,
        scale_label: scaleLabel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upscale-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
