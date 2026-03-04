import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `You are a furniture product analyst. Study ALL of these reference images carefully. They show the SAME product from different angles and distances.

Write a comprehensive product description covering:
1. FORM: Exact type (sofa/chair/sectional), overall silhouette, proportions, number of seats/cushions, arm style, back shape
2. MATERIALS: Primary upholstery (fabric type, colour, texture), secondary materials, any mixed materials
3. LEGS/BASE: Style (tapered, hairpin, turned, block, skirted), material, colour, height
4. DETAILS: Stitching style (piped, tufted, plain), cushion type (fixed, loose, attached), any buttons, rivets, hardware
5. COLOURS: Exact colour descriptions (not just "blue" — say "deep navy blue with subtle warm undertone")
6. UNIQUE FEATURES: Anything distinctive about this specific product

Be extremely specific. This description will be used to ensure AI-generated images reproduce this EXACT product faithfully.`;

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
    if (!image_ids || !Array.isArray(image_ids) || image_ids.length === 0) {
      throw new Error("Missing image_ids array");
    }

    console.log(`Analysing product from ${image_ids.length} images`);

    // Download all images
    const imageParts: Array<Record<string, unknown>> = [];
    for (const imgId of image_ids) {
      const { data: record } = await supabaseAdmin
        .from("images")
        .select("*")
        .eq("id", imgId)
        .eq("user_id", user.id)
        .single();

      if (!record?.original_url) continue;

      const { data: fileData } = await supabaseAdmin.storage
        .from("furniture-images")
        .download(record.original_url);

      if (!fileData) continue;

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const base64 = base64Encode(bytes);
      const mime = record.filename?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      imageParts.push({ inlineData: { mimeType: mime, data: base64 } });
    }

    if (imageParts.length === 0) {
      throw new Error("No valid images found");
    }

    console.log(`Downloaded ${imageParts.length} images for analysis`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Use a text-only model for speed (no image generation needed)
    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let result: string | null = null;

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: ANALYSIS_PROMPT },
                ...imageParts,
              ],
            }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Model ${model} failed:`, response.status, errText.substring(0, 200));
        continue;
      }

      const data = await response.json();
      const textPart = data.candidates?.[0]?.content?.parts?.find(
        (p: Record<string, unknown>) => typeof p.text === "string"
      );
      if (textPart?.text) {
        result = textPart.text;
        console.log(`Analysis complete via ${model}, ${result.length} chars`);
        break;
      }
    }

    if (!result) {
      throw new Error("Failed to analyse product images");
    }

    return new Response(
      JSON.stringify({ success: true, product_analysis: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyse-product error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
