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

    const creditCost = scale === "4x" ? 1 : 0.5;
    const minCredits = scale === "4x" ? 1 : 1; // stored as int, minimum 1

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.credits_remaining < minCredits) {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    console.log("Upscale request | scale:", scale, "| path:", image_path);

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
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64Img}` } },
            ],
          }],
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
      throw new Error("AI upscaling failed");
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
    const deduction = scale === "4x" ? 1 : 1; // minimum integer deduction
    const newCredits = Math.max(0, profile.credits_remaining - deduction);
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
