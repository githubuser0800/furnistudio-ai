import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATES: Record<string, string> = {
  scandinavian:
    'Using the uploaded furniture image as the exact subject to preserve, place this furniture piece in a modern Scandinavian living room. Position it naturally on light oak hardwood flooring. Large floor-to-ceiling windows on the left cast soft natural daylight across the scene. Shadows fall correctly to the right based on the window light source. Include minimal decor: a wool throw draped naturally, one green monstera plant, a simple side table. The furniture appears grounded with subtle contact shadows beneath it. Photorealistic commercial interior photography. Three-point lighting with natural key light from windows. Shot with 35mm lens at f/4. Neutral Scandinavian color palette with whites, light woods, and soft grays. High resolution, professional e-commerce quality.',
  bedroom:
    'Using the uploaded furniture image as the exact subject to preserve, place this furniture piece in a cozy traditional bedroom. Position it on plush cream carpet. Warm ambient lighting from bedside table lamps creates soft pools of light. Evening golden hour light filters through sheer curtains on the right. Shadows are soft and diffused. Include layered textiles: a knitted throw draped with natural folds, plump pillows, and a textured rug. The furniture sits naturally with realistic weight and contact shadows. Photorealistic interior photography with warm color temperature. Soft diffused lighting mimicking evening ambiance. Shot with 50mm lens at f/2.8 for natural perspective. Rich warm tones with creams, soft browns, and muted blues. High resolution, professional e-commerce quality.',
  office:
    'Using the uploaded furniture image as the exact subject to preserve, place this furniture piece in a contemporary home office. Position it on polished light concrete flooring. Large windows behind show a blurred city view with bright natural backlight. A modern desk lamp provides focused task lighting from the left. Shadows fall naturally based on dual light sources. Include minimal props: a closed laptop, a small succulent plant, one design book. The furniture appears grounded with proper contact shadows and subtle reflections on the polished floor. Clean commercial photography style. High-key lighting with natural window backlight and artificial fill. Shot with 35mm lens at f/5.6. Modern color palette with whites, blacks, and warm wood accents. High resolution, professional e-commerce quality.',
  dining:
    'Using the uploaded furniture image as the exact subject to preserve, place this furniture piece in a minimalist dining space. Position it on polished white marble flooring that shows subtle reflections. A single large pendant light hangs above creating a defined pool of light. North-facing windows provide soft even daylight from the left. Shadows are clean and architectural. Include only essential elements: a single ceramic vase with dried pampas grass, simple white tableware. The furniture is the clear focal point with realistic reflections in the marble floor. Editorial interior photography with architectural precision. Dramatic single pendant key light with soft natural fill. Shot with 24mm wide lens at f/8 for maximum sharpness. Monochromatic palette with whites and soft grays. High resolution, professional e-commerce quality.',
  industrial:
    'Using the uploaded furniture image as the exact subject to preserve, place this furniture piece in an industrial loft space. Position it on sealed concrete flooring with visible texture. Exposed red brick wall behind with original mortar texture. Large factory-style steel-framed windows on the left cast dramatic directional light with visible light rays. Strong shadows fall to the right with hard edges. Include urban props: a vintage leather pouf, an Edison bulb floor lamp glowing warm, metal and glass side table. The furniture contrasts against raw industrial textures while appearing naturally placed with proper shadows. Editorial lifestyle photography with cinematic quality. Dramatic directional natural light with warm Edison bulb accents. Shot with 35mm lens at f/2.8. Rich warm brick reds, cool concrete grays, aged metals. High resolution, professional e-commerce quality.',
  british:
    'Using the uploaded furniture image as the exact subject to preserve, place this furniture piece in a classic British drawing room. Position it on a traditional Persian rug over dark oak parquet flooring. An ornate marble fireplace with gilt mirror above is visible to the right. Tall sash windows with floor-length velvet curtains allow soft daylight from the left. Wall sconces provide warm accent lighting. Shadows are soft and sophisticated. Include classic British elements: leather-bound books, silver tea service on a side table, fresh flowers in a crystal vase. The furniture appears as the centrepiece of this curated lived-in space with realistic contact shadows. Luxury editorial interior photography. Soft natural key light mixed with warm artificial accents. Shot with 50mm lens at f/4. Rich British palette with deep greens, burgundies, brass accents. High resolution, professional e-commerce quality.',
};

const RESOLUTION_CREDITS: Record<string, number> = {
  "1k": 1,
  "2k": 2,
  "4k": 3,
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
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { image_id, template_id, resolution } = await req.json();

    if (!TEMPLATES[template_id]) throw new Error("Invalid template");
    const creditsNeeded = RESOLUTION_CREDITS[resolution] || 1;

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.credits_remaining < creditsNeeded) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          credits_remaining: profile?.credits_remaining || 0,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get image record
    const { data: imageRecord } = await supabaseAdmin
      .from("images")
      .select("*")
      .eq("id", image_id)
      .eq("user_id", user.id)
      .single();

    if (!imageRecord?.original_url) throw new Error("Image not found");

    // Create job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .insert({
        user_id: user.id,
        image_id,
        template_id,
        credits_used: creditsNeeded,
        status: "processing",
      })
      .select()
      .single();

    if (jobErr || !job) throw new Error("Failed to create job");

    // Download original image from storage
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .download(imageRecord.original_url);

    if (dlErr || !fileData) {
      await supabaseAdmin
        .from("jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      throw new Error("Failed to download image");
    }

    const imageBytes = new Uint8Array(await fileData.arrayBuffer());
    const base64Image = base64Encode(imageBytes);

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const prompt = TEMPLATES[template_id];

    console.log("Calling AI gateway with template:", template_id);

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
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      await supabaseAdmin
        .from("jobs")
        .update({ status: "failed" })
        .eq("id", job.id);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "AI service rate limited. Please try again shortly.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI service payment required. Please add credits.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw new Error("AI generation failed");
    }

    const aiResult = await aiResponse.json();
    console.log(
      "AI response received, parsing image...",
      JSON.stringify(aiResult).substring(0, 200)
    );

    // Extract generated image from response
    let generatedBase64: string | null = null;
    let generatedMimeType = "image/png";

    const content = aiResult.choices?.[0]?.message?.content;

    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const match = part.image_url.url.match(
            /^data:([^;]+);base64,(.+)$/s
          );
          if (match) {
            generatedMimeType = match[1];
            generatedBase64 = match[2];
            break;
          }
        }
        if (part.inline_data) {
          generatedMimeType = part.inline_data.mime_type || "image/png";
          generatedBase64 = part.inline_data.data;
          break;
        }
      }
    }

    // Fallback: try parsing from string content
    if (!generatedBase64 && typeof content === "string") {
      const match = content.match(/data:([^;]+);base64,([A-Za-z0-9+/=\s]+)/s);
      if (match) {
        generatedMimeType = match[1];
        generatedBase64 = match[2].replace(/\s/g, "");
      }
    }

    if (!generatedBase64) {
      await supabaseAdmin
        .from("jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      console.error(
        "No image in AI response:",
        JSON.stringify(aiResult).substring(0, 1000)
      );
      throw new Error("AI did not return an image. Please try again.");
    }

    // Decode and upload generated image
    const ext = generatedMimeType.includes("png") ? "png" : "jpg";
    const outputPath = `${user.id}/outputs/${job.id}.${ext}`;

    const binaryString = atob(generatedBase64);
    const outputBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      outputBytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .upload(outputPath, outputBytes, { contentType: generatedMimeType });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      await supabaseAdmin
        .from("jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      throw new Error("Failed to store generated image");
    }

    // Update job status
    await supabaseAdmin
      .from("jobs")
      .update({ status: "completed", output_url: outputPath })
      .eq("id", job.id);

    // Deduct credits
    await supabaseAdmin
      .from("profiles")
      .update({
        credits_remaining: profile.credits_remaining - creditsNeeded,
      })
      .eq("id", user.id);

    // Get signed URL for the result
    const { data: signedUrl } = await supabaseAdmin.storage
      .from("furniture-images")
      .createSignedUrl(outputPath, 3600);

    console.log("Generation complete. Job:", job.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        output_url: signedUrl?.signedUrl || null,
        credits_remaining: profile.credits_remaining - creditsNeeded,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("generate-staging error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
