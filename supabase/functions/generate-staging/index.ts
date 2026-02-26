import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT_SUFFIX =
  "Photorealistic commercial photography. Natural lighting with realistic shadows matching light source direction. Furniture appears grounded with contact shadows. High resolution, professional e-commerce quality.";

const TEMPLATES: Record<string, string> = {
  // LIVING ROOM
  scandinavian:
    `Place this furniture piece in a modern Scandinavian living room. Light oak hardwood flooring, white walls, floor-to-ceiling windows casting soft natural daylight. Minimal decor: a wool throw, monstera plant, simple side table. Neutral palette with whites, light woods, soft grays. Shot with 35mm lens at f/4. ${PROMPT_SUFFIX}`,
  contemporary_grey:
    `Place this furniture piece in a contemporary living room with warm grey walls. Soft afternoon light filtering through sheer curtains. Textured area rug on the floor, minimalist abstract art on the wall. Warm neutral tones with gentle shadow play. Shot with 50mm lens at f/4. ${PROMPT_SUFFIX}`,
  cozy_british:
    `Place this furniture piece in a classic British drawing room. Traditional fireplace with gilt mirror, Persian rug over dark oak parquet. Tall sash windows with floor-length velvet curtains. Leather-bound books, silver tea service, fresh flowers in crystal vase. Rich greens, burgundies, brass accents. Shot with 50mm lens at f/4. ${PROMPT_SUFFIX}`,
  luxury_penthouse:
    `Place this furniture piece in a luxury penthouse apartment. Floor-to-ceiling windows with city skyline view, polished marble floors with subtle reflections. Golden hour light streaming in. Designer accents, sculptural lighting. Palette of warm golds, cool marble whites, deep charcoals. Shot with 24mm lens at f/5.6. ${PROMPT_SUFFIX}`,
  minimalist_white:
    `Place this furniture piece in a pure minimalist interior. White walls, light concrete floor, stark directional light from a single large window. Almost no decor—clean lines, negative space. The furniture is the sole focal point. Monochromatic whites and grays. Shot with 35mm lens at f/8. ${PROMPT_SUFFIX}`,

  // BEDROOM
  serene_bedroom:
    `Place this furniture piece in a serene bedroom setting. Soft white walls, plush cream carpet, gentle morning light filtering through linen curtains. Layered white bedding, soft textiles. Calm, airy atmosphere with muted pastel accents. Shot with 50mm lens at f/2.8. ${PROMPT_SUFFIX}`,
  boutique_hotel:
    `Place this furniture piece in a boutique hotel room. Dark forest green walls, brass pendant light casting warm pools of light. Velvet cushions, moody atmospheric lighting. Rich jewel tones with gold accents. Evening ambiance. Shot with 35mm lens at f/2.8. ${PROMPT_SUFFIX}`,
  light_airy:
    `Place this furniture piece in a light and airy bedroom. White shiplap walls, bleached oak floor, abundant natural light from multiple windows. Rattan accents, trailing plants, linen textiles. Coastal-inspired fresh palette. Shot with 35mm lens at f/4. ${PROMPT_SUFFIX}`,

  // DINING
  modern_dining:
    `Place this furniture piece in a modern dining space. Statement pendant light above, dark oak flooring. Table set with white tableware and linen napkins. Large windows with garden view. Warm natural tones. Shot with 24mm lens at f/5.6. ${PROMPT_SUFFIX}`,
  rustic_farmhouse:
    `Place this furniture piece in a rustic farmhouse dining room. Exposed ceiling beams, whitewashed walls, reclaimed wood floor. Vintage pendant lights, linen table runner, ceramic pitcher with wildflowers. Warm earthy palette. Shot with 35mm lens at f/4. ${PROMPT_SUFFIX}`,

  // OFFICE
  modern_office:
    `Place this furniture piece in a modern home office. Clean white walls, large window with city or garden view. Minimal desk setup, built-in shelving with books and plants. Bright, focused atmosphere. Shot with 35mm lens at f/5.6. ${PROMPT_SUFFIX}`,
  creative_studio:
    `Place this furniture piece in a creative studio space. White brick walls, polished concrete floor, large industrial windows. Mood boards on the wall, trailing plants, warm task lighting. Inspiring creative atmosphere. Shot with 24mm lens at f/4. ${PROMPT_SUFFIX}`,

  // STUDIO / PRODUCT
  white_background:
    `Place this furniture piece on a pure white background (RGB 255,255,255). Even, shadowless studio lighting from all angles. The product fills 85% of the frame, perfectly centered. Clean e-commerce product photography, no environment, no shadows, no floor visible. Shot with 85mm lens at f/11. ${PROMPT_SUFFIX}`,
  grey_studio:
    `Place this furniture piece on a seamless medium grey studio background. Professional three-point lighting setup: key light from upper left, fill light from right, backlight for rim separation. Subtle ground shadow. Clean commercial product photography. Shot with 85mm lens at f/8. ${PROMPT_SUFFIX}`,
  showroom_floor:
    `Place this furniture piece on a polished concrete showroom floor. Track lighting from above creating defined highlights. Other furniture pieces visible but tastefully blurred in the background. Professional furniture showroom atmosphere. Shot with 50mm lens at f/2.8 for shallow depth of field. ${PROMPT_SUFFIX}`,
};

// Custom prompt builder
function buildCustomPrompt(userInput: string): string {
  return `Place this furniture in ${userInput}. Photorealistic interior photography with natural lighting and realistic shadows. Professional e-commerce quality. ${PROMPT_SUFFIX}`;
}

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
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { image_id, template_id, resolution, custom_prompt, aspect_ratio } = await req.json();

    // Build prompt
    let prompt: string;
    if (template_id === "custom" && custom_prompt) {
      prompt = buildCustomPrompt(custom_prompt);
    } else if (TEMPLATES[template_id]) {
      prompt = `Using the uploaded furniture image as the exact subject to preserve, ${TEMPLATES[template_id]}`;
    } else {
      throw new Error("Invalid template");
    }

    // Add aspect ratio instruction
    if (aspect_ratio && aspect_ratio !== "1:1") {
      prompt += ` Output the image in ${aspect_ratio} aspect ratio.`;
    }

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
        template_id: template_id === "custom" ? "custom" : template_id,
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
          modalities: ["image", "text"],
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
      throw new Error("AI generation failed");
    }

    const aiResult = await aiResponse.json();
    console.log("AI response received, parsing image...", JSON.stringify(aiResult).substring(0, 200));

    // Extract generated image from response
    let generatedBase64: string | null = null;
    let generatedMimeType = "image/png";

    const message = aiResult.choices?.[0]?.message;

    // Check message.images[] (Lovable AI gateway format)
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

    // Fallback: check content array
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
      console.error("No image in AI response:", JSON.stringify(aiResult).substring(0, 1000));
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
