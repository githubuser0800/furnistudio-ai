import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Product Preservation Prefix (prepended to EVERY prompt) ──
const PRODUCT_PRESERVATION = `Using the uploaded furniture image as the PRIMARY REFERENCE that must be preserved EXACTLY. Maintain the exact shape, proportions, materials, textures, colors, and all design details. Only change the background environment.

QUALITY NON-NEGOTIABLES:
- Furniture product is identical to uploaded image
- No extra legs, arms, or altered proportions
- Materials look the same (not changed from fabric to leather, etc.)
- Colors match the original
- Furniture is properly grounded (not floating)
- Shadows are physically accurate
- Scale is realistic for the room`;

// ── Technical Flavor (appended to every prompt) ──
const TECHNICAL_FLAVOR = `[TECHNICAL FLAVOR]: Subtle depth of field with background slightly soft. Natural material textures clearly rendered. Gentle photographic grain visible at full resolution.`;

// ── Camera Angle Prompts ──
const CAMERA_ANGLE_PROMPTS: Record<string, string> = {
  standard: "Camera at eye level, straight-on view of the furniture.",
  elevated: "Camera positioned slightly above at 30-degree downward angle, showing top surface and front.",
  low_angle: "Camera low to ground, angled upward, making furniture appear grand and substantial.",
  side_profile: "Camera at 90-degree side angle, showing furniture profile silhouette.",
  corner_view: "Camera at 45-degree angle showing front and side, three-quarter view.",
};

// ── Template definitions using C.S.S.T. framework ──
interface TemplateConfig {
  mood: string;
  contextAnchor: string;
  roomDescription: string;
  flooring: string;
  lightSource: string;
  shadowDirection: string;
  propsDecor: string;
  lightingDescription: string;
  styleReference: string;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  // LIVING ROOM
  scandinavian: {
    mood: "calm, clean, and effortlessly modern",
    contextAnchor: "a Scandinavian Design Centre catalogue shot",
    roomDescription: "a modern Scandinavian living room with floor-to-ceiling windows casting soft natural daylight, white walls, and minimal decor",
    flooring: "light oak hardwood flooring",
    lightSource: "Soft natural daylight from large windows",
    shadowDirection: "gentle diffused shadows falling to the right",
    propsDecor: "a wool throw draped nearby, a monstera plant in a ceramic pot, and a simple oak side table",
    lightingDescription: "Soft, even natural daylight flooding through sheer curtains. No harsh shadows",
    styleReference: "Kinfolk magazine interior photography, shot with 35mm lens at f/4",
  },
  contemporary_grey: {
    mood: "warm, sophisticated, and inviting",
    contextAnchor: "a Habitat or Made.com lifestyle shoot",
    roomDescription: "a contemporary living room with warm grey walls and soft afternoon light filtering through sheer curtains",
    flooring: "a textured wool area rug over grey-toned engineered wood",
    lightSource: "Warm afternoon sun filtering through sheer curtains",
    shadowDirection: "soft warm shadows falling to the left",
    propsDecor: "minimalist abstract art on the wall, a ceramic vase with dried pampas grass, and stacked coffee table books",
    lightingDescription: "Warm, golden-hour afternoon light with gentle shadow play",
    styleReference: "Elle Decoration UK editorial, shot with 50mm lens at f/4",
  },
  cozy_british: {
    mood: "rich, traditional, and quintessentially British",
    contextAnchor: "a Country Life or Homes & Gardens magazine feature",
    roomDescription: "a classic British drawing room with a traditional fireplace, gilt mirror above, and tall sash windows with floor-length velvet curtains",
    flooring: "dark oak parquet with a Persian rug",
    lightSource: "Soft natural light from tall sash windows mixed with warm firelight glow",
    shadowDirection: "warm layered shadows with firelight creating depth",
    propsDecor: "leather-bound books on shelves, a silver tea service on a side table, fresh flowers in a crystal vase, and velvet cushions",
    lightingDescription: "Rich, warm interior light mixing window daylight with ambient fireplace glow",
    styleReference: "Country Life magazine interiors, shot with 50mm lens at f/4",
  },
  luxury_penthouse: {
    mood: "glamorous, aspirational, and urban-luxe",
    contextAnchor: "a Robb Report or Architectural Digest penthouse feature",
    roomDescription: "a luxury penthouse apartment with floor-to-ceiling windows revealing a city skyline at golden hour",
    flooring: "polished Italian marble with subtle veining and gentle reflections",
    lightSource: "Golden hour sunlight streaming through panoramic windows",
    shadowDirection: "long dramatic golden shadows stretching across the marble floor",
    propsDecor: "sculptural designer lighting, a curated art piece, and a champagne-toned accent table",
    lightingDescription: "Dramatic golden-hour light with rich warm tones and defined highlights on marble surfaces",
    styleReference: "Architectural Digest luxury editorial, shot with 24mm lens at f/5.6",
  },
  minimalist_white: {
    mood: "pure, stark, and gallery-like",
    contextAnchor: "a Vitsoe or Vitra minimalist showroom photograph",
    roomDescription: "a pure minimalist interior with white walls and stark directional light from a single large window. Almost no decor—the furniture is the sole focal point",
    flooring: "light polished concrete",
    lightSource: "Single directional light from one large window",
    shadowDirection: "clean defined shadows falling sharply to one side",
    propsDecor: "virtually nothing—pure negative space with perhaps a single geometric object",
    lightingDescription: "Stark, clean directional light creating bold contrast between light and shadow",
    styleReference: "Cereal magazine minimalism, shot with 35mm lens at f/8",
  },

  // BEDROOM
  serene_bedroom: {
    mood: "peaceful, soft, and sanctuary-like",
    contextAnchor: "a The White Company or Loaf bedroom catalogue",
    roomDescription: "a serene bedroom with soft white walls, gentle morning light filtering through linen curtains, and layered white bedding",
    flooring: "plush cream carpet",
    lightSource: "Gentle morning sunlight filtering through linen curtains",
    shadowDirection: "very soft diffused shadows with minimal contrast",
    propsDecor: "layered white and cream textiles, a ceramic bedside lamp, and a small vase of dried eucalyptus",
    lightingDescription: "Soft, dreamy morning light with a warm glow. Ethereal and calming atmosphere",
    styleReference: "The White Company brand photography, shot with 50mm lens at f/2.8",
  },
  boutique_hotel: {
    mood: "moody, luxurious, and intimate",
    contextAnchor: "a boutique hotel feature in Condé Nast Traveller",
    roomDescription: "a boutique hotel room with dark forest green walls, brass pendant lights casting warm pools of light, and velvet cushions",
    flooring: "dark herringbone timber with a plush area rug",
    lightSource: "Warm brass pendant lights and subtle ambient uplighting",
    shadowDirection: "dramatic pools of warm light with deep atmospheric shadows",
    propsDecor: "velvet cushions in jewel tones, a brass-framed mirror, a stack of art books, and a cashmere throw",
    lightingDescription: "Moody, warm atmospheric lighting with brass-toned highlights. Evening ambiance",
    styleReference: "Condé Nast Traveller hotel interiors, shot with 35mm lens at f/2.8",
  },
  light_airy: {
    mood: "fresh, coastal, and relaxed",
    contextAnchor: "a Neptune or seaside cottage feature in Living Etc",
    roomDescription: "a light and airy bedroom with white shiplap walls, abundant natural light from multiple windows, and rattan accents",
    flooring: "bleached oak floorboards",
    lightSource: "Bright natural daylight from multiple windows",
    shadowDirection: "light, airy shadows with high-key brightness throughout",
    propsDecor: "rattan baskets, trailing pothos plants, linen textiles in natural tones, and a driftwood accent",
    lightingDescription: "Bright, high-key natural light creating a fresh, sun-washed coastal feel",
    styleReference: "Living Etc coastal interiors, shot with 35mm lens at f/4",
  },

  // DINING
  modern_dining: {
    mood: "sociable, warm, and contemporary",
    contextAnchor: "a Heal's or Habitat dining collection campaign",
    roomDescription: "a modern dining space with a statement pendant light above, large windows with a garden view",
    flooring: "dark oak engineered wood",
    lightSource: "Statement pendant light above plus natural window light from the side",
    shadowDirection: "defined downward shadows from pendant with softer side-fill from windows",
    propsDecor: "white tableware set for dinner, linen napkins, a ceramic jug with fresh greenery, and simple dining chairs",
    lightingDescription: "Warm pendant glow combined with cool natural window light creating dimensional lighting",
    styleReference: "Heal's lifestyle campaign, shot with 24mm lens at f/5.6",
  },
  rustic_farmhouse: {
    mood: "honest, warm, and countryside charm",
    contextAnchor: "a feature in Country Homes & Interiors magazine",
    roomDescription: "a rustic farmhouse dining room with exposed ceiling beams, whitewashed walls, and vintage character",
    flooring: "reclaimed wide-plank timber",
    lightSource: "Warm natural light from a farmhouse window plus vintage pendant lights",
    shadowDirection: "warm, textured shadows with beam patterns on the table",
    propsDecor: "a linen table runner, a ceramic pitcher with wildflowers, mismatched vintage chairs, and a bread board with artisan loaf",
    lightingDescription: "Warm, rustic lighting mixing natural window light with vintage pendant glow",
    styleReference: "Country Homes & Interiors editorial, shot with 35mm lens at f/4",
  },

  // OFFICE
  modern_office: {
    mood: "productive, clean, and inspiring",
    contextAnchor: "a John Lewis home office collection shoot",
    roomDescription: "a modern home office with clean white walls, a large window with city or garden view, and built-in shelving",
    flooring: "light timber or clean carpet",
    lightSource: "Bright natural daylight from a large desk-side window",
    shadowDirection: "clean shadows from window light falling across the desk area",
    propsDecor: "neatly arranged books, a small potted plant, a designer desk lamp, and minimal desk accessories",
    lightingDescription: "Bright, focused natural daylight ideal for a productive workspace",
    styleReference: "John Lewis Home campaign photography, shot with 35mm lens at f/5.6",
  },
  creative_studio: {
    mood: "inspiring, artistic, and industrially chic",
    contextAnchor: "a creative workspace feature in Dezeen or Monocle",
    roomDescription: "a creative studio space with white brick walls, large industrial windows, and an inspiring artistic atmosphere",
    flooring: "polished concrete",
    lightSource: "Large industrial windows letting in abundant natural light",
    shadowDirection: "industrial window-frame shadow patterns with bright even fill",
    propsDecor: "mood boards pinned to the wall, trailing plants from shelves, warm task lighting, and art supplies",
    lightingDescription: "Bright, even industrial light with warm task-light accents",
    styleReference: "Monocle workspace editorial, shot with 24mm lens at f/4",
  },

  // STUDIO / PRODUCT
  white_background: {
    mood: "clean, professional, and product-focused",
    contextAnchor: "a pure e-commerce product shot for a premium retailer website",
    roomDescription: "a pure white background (RGB 255,255,255) with even, shadowless studio lighting from all angles. The product fills 85% of the frame, perfectly centered. No environment, no floor visible",
    flooring: "seamless white infinity curve",
    lightSource: "Even multi-point studio lighting eliminating all shadows",
    shadowDirection: "no shadows—completely even illumination",
    propsDecor: "absolutely nothing—pure white background only",
    lightingDescription: "Professional multi-point studio lighting for zero-shadow product photography",
    styleReference: "Premium e-commerce product photography, shot with 85mm lens at f/11",
  },
  grey_studio: {
    mood: "professional, refined, and studio-quality",
    contextAnchor: "a professional furniture product photograph for a premium catalogue",
    roomDescription: "a seamless medium grey studio background with professional three-point lighting: key light from upper left, fill light from right, backlight for rim separation",
    flooring: "seamless grey studio backdrop sweeping to floor",
    lightSource: "Professional three-point lighting setup",
    shadowDirection: "defined key shadow to the right with fill-softened edges and rim highlight behind",
    propsDecor: "nothing—clean studio environment",
    lightingDescription: "Professional three-point studio lighting with key, fill, and backlight for dimensional product photography",
    styleReference: "High-end furniture catalogue product shot, shot with 85mm lens at f/8",
  },
  showroom_floor: {
    mood: "contextual, premium, and showroom-realistic",
    contextAnchor: "an in-situ showroom shot for a furniture retailer like Ligne Roset or B&B Italia",
    roomDescription: "a polished concrete showroom floor with track lighting from above. Other furniture pieces visible but tastefully blurred in the background",
    flooring: "polished concrete showroom floor with subtle reflections",
    lightSource: "Professional track lighting from above creating defined highlights",
    shadowDirection: "defined downward shadows from track spots with gentle floor reflections",
    propsDecor: "blurred companion furniture pieces in the background suggesting a curated showroom",
    lightingDescription: "Professional showroom track lighting creating focused highlights and dimensional shadows",
    styleReference: "Premium furniture showroom photography, shot with 50mm lens at f/2.8 for shallow depth of field",
  },
};

// ── Batch consistency prefix ──
function buildBatchConsistencyPrefix(batchInfo: { index: number; total: number; label?: string } | null, config: TemplateConfig | null): string {
  if (!batchInfo || batchInfo.total <= 1) return "";

  const roomDetails = config
    ? `Wall color: ${config.roomDescription}. Flooring: ${config.flooring}. Lighting setup: ${config.lightSource}, ${config.shadowDirection}. Props: ${config.propsDecor}.`
    : "";

  if (batchInfo.index === 0) {
    return `BATCH CONSISTENCY REQUIREMENT: This is image ${batchInfo.index + 1} of ${batchInfo.total} in a product set. ALL images in this set must appear as if photographed in the EXACT SAME ROOM during the SAME photoshoot session. This is the HERO image — establish the room environment precisely. ${roomDetails}

Maintain identical room layout, architecture, wall colors, flooring, lighting setup, light direction, shadow angles, color temperature, mood, background props in same positions, and time of day atmosphere across the entire set. The ONLY difference between images should be the furniture product itself and its position/angle in the scene.

`;
  }

  const labelHint = batchInfo.label?.toLowerCase() || "";
  const isCloseUp = labelHint.includes("close") || labelHint.includes("detail") || labelHint.includes("fabric") || labelHint.includes("texture");

  const closeUpNote = isCloseUp
    ? " This is a close-up/detail shot: show PARTIAL room background (blurred floor, partial wall visible). Same flooring color/material at edges, same lighting direction and color temperature, same ambient mood — but zoomed in on furniture detail."
    : " Match the exact room environment from the first image in this batch. Same walls, floor, lighting, props, atmosphere.";

  return `BATCH CONSISTENCY REQUIREMENT: This is image ${batchInfo.index + 1} of ${batchInfo.total} in a product set. ALL images in this set must appear as if photographed in the EXACT SAME ROOM during the SAME photoshoot session. ${roomDetails}${closeUpNote}

`;
}

// ── Build a full C.S.S.T. prompt from a template config ──
function buildTemplatePrompt(
  config: TemplateConfig,
  aspectRatio: string,
  resolution: string,
  cameraAngle: string | null,
  batchInfo: { index: number; total: number; label?: string } | null = null
): string {
  const angleInstruction = cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]
    ? ` ${CAMERA_ANGLE_PROMPTS[cameraAngle]}`
    : " Camera at eye level, straight-on view of the furniture.";

  const batchPrefix = buildBatchConsistencyPrefix(batchInfo, config);

  return `${batchPrefix}${PRODUCT_PRESERVATION}

[CONTEXT]: This image is for premium UK furniture e-commerce. The tone is ${config.mood}. Think of it as ${config.contextAnchor}.

[SUBJECT & LOGIC]: Place this exact furniture piece naturally in ${config.roomDescription}. The furniture sits on ${config.flooring}. ${config.lightSource} casts ${config.shadowDirection}. Include ${config.propsDecor}. The furniture appears grounded with realistic contact shadows where it meets the floor. Scale is accurate for a real interior.${angleInstruction}

[STYLE]: Photorealistic commercial interior photography. ${config.lightingDescription}. Reference: ${config.styleReference}.

${TECHNICAL_FLAVOR}

[OUTPUT]: ${aspectRatio || "1:1"}. ${resolution || "1k"} resolution.`;
}

// ── Build a C.S.S.T. prompt from a custom user description ──
function buildCustomPrompt(
  userInput: string,
  aspectRatio: string,
  resolution: string,
  cameraAngle: string | null,
  batchInfo: { index: number; total: number; label?: string } | null = null
): string {
  const angleInstruction = cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]
    ? ` ${CAMERA_ANGLE_PROMPTS[cameraAngle]}`
    : "";

  const batchPrefix = buildBatchConsistencyPrefix(batchInfo, null);

  return `${batchPrefix}${PRODUCT_PRESERVATION}

[CONTEXT]: Professional UK furniture e-commerce photography. The tone is aspirational and lifestyle-focused. Think of it as a premium furniture retailer catalogue.

[SUBJECT & LOGIC]: Place this exact furniture piece naturally in ${userInput}. Ensure the furniture appears grounded with realistic contact shadows. Shadows fall correctly based on visible light sources. Scale is accurate for a real interior space.${angleInstruction}

[STYLE]: Photorealistic commercial interior photography. Natural lighting that accurately represents furniture materials. Reference: high-end British furniture retail photography.

${TECHNICAL_FLAVOR}

[OUTPUT]: ${aspectRatio || "1:1"}. ${resolution || "1k"} resolution.`;
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

    const { image_id, template_id, resolution, custom_prompt, aspect_ratio, camera_angle, set_id, label, batch_index, batch_total } = await req.json();

    // Build batch info if present
    const batchInfo = typeof batch_index === "number" && typeof batch_total === "number" && batch_total > 1
      ? { index: batch_index, total: batch_total, label: label || undefined }
      : null;

    // Build prompt using C.S.S.T. framework
    let prompt: string;
    if (template_id === "custom" && custom_prompt) {
      prompt = buildCustomPrompt(custom_prompt, aspect_ratio, resolution, camera_angle, batchInfo);
    } else if (TEMPLATES[template_id]) {
      prompt = buildTemplatePrompt(TEMPLATES[template_id], aspect_ratio, resolution, camera_angle, batchInfo);
    } else {
      throw new Error("Invalid template");
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
        camera_angle: camera_angle || null,
        resolution: resolution || "1k",
        set_id: set_id || null,
        label: label || null,
      })
      .select()
      .single();

    if (jobErr || !job) throw new Error("Failed to create job");

    // Download original image from storage
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .download(imageRecord.original_url);

    if (dlErr || !fileData) {
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      throw new Error("Failed to download image");
    }

    const imageBytes = new Uint8Array(await fileData.arrayBuffer());
    const base64Image = base64Encode(imageBytes);

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    console.log("Calling AI gateway with template:", template_id, "| Prompt length:", prompt.length);

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
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);

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
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
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
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
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
      .update({ credits_remaining: profile.credits_remaining - creditsNeeded })
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-staging error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
