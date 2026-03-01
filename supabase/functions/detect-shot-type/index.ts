import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOT_TYPES = [
  "Full Product",
  "3/4 Angle",
  "Side View",
  "Back View",
  "Close-up: Arm",
  "Close-up: Seat",
  "Close-up: Leg",
  "Close-up: Fabric",
  "Close-up: Detail",
  "Feature: Reclined",
  "Feature: Extended",
  "Top View",
  "Corner View",
];

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

    const { image_ids } = await req.json();
    if (!Array.isArray(image_ids) || image_ids.length === 0) {
      throw new Error("Missing image_ids array");
    }
    if (image_ids.length > 50) {
      throw new Error("Maximum 50 images per request");
    }

    // Fetch image records
    const { data: images } = await supabaseAdmin
      .from("images")
      .select("id, original_url, filename")
      .in("id", image_ids)
      .eq("user_id", user.id);

    if (!images || images.length === 0) throw new Error("No images found");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const results: Array<{ image_id: string; detected_type: string; confidence: string }> = [];

    // Process images in parallel (up to 5 at a time)
    const batchSize = 5;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      
      const promises = batch.map(async (img) => {
        if (!img.original_url) {
          return { image_id: img.id, detected_type: "Full Product", confidence: "low" };
        }

        try {
          const { data: fileData } = await supabaseAdmin.storage
            .from("furniture-images")
            .download(img.original_url);

          if (!fileData) {
            return { image_id: img.id, detected_type: "Full Product", confidence: "low" };
          }

          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const base64 = base64Encode(bytes);
          const mime = img.filename?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

          const aiResponse = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: `Classify this furniture photograph into EXACTLY ONE of these shot types. Respond with ONLY the type name, nothing else.

Types:
${SHOT_TYPES.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Rules:
- "Full Product" = entire furniture piece visible, catalog-style
- "3/4 Angle" = front and side visible at ~45 degrees
- "Side View" = 90-degree profile view
- "Back View" = rear of furniture
- "Close-up: Arm" = zoomed into armrest area
- "Close-up: Seat" = zoomed into seat/cushion
- "Close-up: Leg" = zoomed into legs/base
- "Close-up: Fabric" = extreme close-up of material texture
- "Close-up: Detail" = buttons, stitching, hardware close-up
- "Feature: Reclined" = furniture in reclined/extended state
- "Feature: Extended" = furniture opened/extended
- "Top View" = looking down from above
- "Corner View" = similar to 3/4 but emphasizing the corner

Respond with ONLY the type name.`,
                      },
                      {
                        type: "image_url",
                        image_url: { url: `data:${mime};base64,${base64}` },
                      },
                    ],
                  },
                ],
                temperature: 0.1,
              }),
            }
          );

          if (!aiResponse.ok) {
            console.error("AI classify error:", aiResponse.status);
            return { image_id: img.id, detected_type: "Full Product", confidence: "low" };
          }

          const aiResult = await aiResponse.json();
          const rawText = (aiResult.choices?.[0]?.message?.content || "").trim();
          
          // Match to closest known type
          const matched = SHOT_TYPES.find(
            (t) => rawText.toLowerCase().includes(t.toLowerCase())
          ) || "Full Product";
          
          const confidence = rawText.toLowerCase() === matched.toLowerCase() ? "high" : "medium";

          return { image_id: img.id, detected_type: matched, confidence };
        } catch (err) {
          console.error("Detection error for", img.id, err);
          return { image_id: img.id, detected_type: "Full Product", confidence: "low" };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    console.log("Shot detection complete:", results.length, "images processed");

    return new Response(
      JSON.stringify({ success: true, detections: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("detect-shot-type error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
