import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── MANDATORY Product Preservation Prefix (Nano Banana Pro) ──
const PRODUCT_PRESERVATION = `PRIMARY REFERENCE PRESERVATION: The uploaded furniture image must appear IDENTICALLY in the output. Maintain:
- EXACT silhouette and proportions - do not alter shape
- EXACT materials - if velvet show velvet, if leather show leather, if oak show oak
- EXACT colors and tones - match precise shades
- EXACT details - every button, stitch, seam, leg, arm, cushion, hardware
- EXACT textures - fabric weave, wood grain, metal finish
This is product photography - the furniture must be the SAME product, not a similar one. Only the background environment changes.`;

// ── Photorealistic Imperfections Pool ──
const IMPERFECTIONS = [
  "Subtle handheld camera micro-vibration suggesting a real photographer held the camera",
  "Slight chromatic aberration visible at the far edges of the frame",
  "Natural film grain barely visible in the shadow areas at full resolution",
  "Gentle depth of field drift softening the background gradually",
  "Faint lens vignette darkening the extreme corners of the image",
  "Dust particles faintly visible in the window light shaft",
  "Natural sensor noise in the deepest shadow regions",
];

function pickImperfections(count = 2): string[] {
  const shuffled = [...IMPERFECTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Camera Angle Prompts (full sentences, no keyword tags) ──
const CAMERA_ANGLE_PROMPTS: Record<string, string> = {
  standard: "The camera is positioned at eye level, looking straight on at the furniture piece, creating a direct and honest perspective that a customer would see in a showroom.",
  elevated: "The camera is positioned slightly above at approximately a 30-degree downward angle, revealing the top surface and front of the furniture in a classic three-quarter overhead view.",
  low_angle: "The camera is positioned low to the ground, angled upward toward the furniture, making it appear grand and substantial with an aspirational quality.",
  side_profile: "The camera is positioned at a precise 90-degree side angle, capturing the full silhouette profile of the furniture piece against the room environment.",
  corner_view: "The camera is positioned at a 45-degree angle showing both the front face and one side of the furniture, creating a dimensional three-quarter view.",
};

// ── Template definitions using C.S.S.T. framework (Nano Banana Pro) ──
interface TemplateConfig {
  mood: string;
  contextAnchor: string;
  roomDescription: string;
  wallDescription: string;
  flooring: string;
  flooringDirection: string;
  lightSource: string;
  lightQuality: string;
  lightDirection: string;
  shadowDirection: string;
  propsPositioned: string;
  materialBehavior: string;
  lightingSetup: string;
  styleReference: string;
  lensSpec: string;
  atmosphere: string;
}

// ── Room Lock structure for batch consistency ──
interface RoomLock {
  room_template: string;
  wall_color: string;
  floor: string;
  floor_direction: string;
  light_source: string;
  light_quality: string;
  light_direction: string;
  shadow_direction: string;
  props: string[];
  atmosphere: string;
}

function extractRoomLock(templateId: string, config: TemplateConfig): RoomLock {
  return {
    room_template: templateId,
    wall_color: config.wallDescription,
    floor: config.flooring,
    floor_direction: config.flooringDirection,
    light_source: config.lightSource,
    light_quality: config.lightQuality,
    light_direction: config.lightDirection,
    shadow_direction: config.shadowDirection,
    props: config.propsPositioned.split(". ").filter(Boolean),
    atmosphere: config.atmosphere,
  };
}

const TEMPLATES: Record<string, TemplateConfig> = {
  // ═══════════ LIVING ROOM ═══════════
  scandinavian: {
    mood: "calm, clean, and effortlessly modern",
    contextAnchor: "a hero image from the Made.com product catalogue",
    roomDescription: "a modern Scandinavian living room with floor-to-ceiling windows allowing soft natural daylight to flood the space, creating an airy and aspirational atmosphere",
    wallDescription: "Clean white walls with a subtle matte texture that softly reflects the natural daylight",
    flooring: "light oak hardwood",
    flooringDirection: "with grain running left to right across the frame",
    lightSource: "A large floor-to-ceiling window",
    lightQuality: "soft diffused natural morning light",
    lightDirection: "positioned on the LEFT side of the room",
    shadowDirection: "Shadows fall gently to the RIGHT, with the furniture casting a soft diffused shadow on the floor matching the window light angle",
    propsPositioned: "A monstera plant in a white ceramic pot positioned in the rear-left of the frame. A grey wool throw draped casually nearby. A simple oak side table with a small ceramic vase placed to the right",
    materialBehavior: "The oak floor catches a soft natural reflection from the window light, grounding the furniture with realistic weight",
    lightingSetup: "Soft diffused window light as key from the left, gentle ambient fill bouncing from the white walls, subtle rim light separating furniture from the background",
    styleReference: "the clean naturalistic look of Kinfolk magazine interior photography",
    lensSpec: "Shot with a 35mm lens at f/4",
    atmosphere: "bright, airy, and aspirational Scandinavian morning",
  },
  contemporary_grey: {
    mood: "warm, sophisticated, and inviting",
    contextAnchor: "a lifestyle editorial spread in Elle Decoration UK",
    roomDescription: "a contemporary living room with warm grey walls that create a cocooning atmosphere, with soft afternoon light filtering through sheer linen curtains",
    wallDescription: "Warm grey walls with a subtle flat paint finish that absorbs light softly without harsh reflections",
    flooring: "grey-toned engineered wood partially covered by a textured wool area rug",
    flooringDirection: "with planks running diagonally from rear-left to front-right",
    lightSource: "Sheer linen curtains diffusing afternoon sunlight",
    lightQuality: "warm golden-hour afternoon light",
    lightDirection: "positioned on the RIGHT side of the room",
    shadowDirection: "Shadows fall softly to the LEFT with warm tones, creating gentle depth across the scene",
    propsPositioned: "Minimalist abstract art in a thin black frame hung on the rear wall. A tall ceramic vase with dried pampas grass positioned rear-right. Stacked coffee table books on a low side table to the left",
    materialBehavior: "The textured rug absorbs light with no specular highlights while the engineered wood shows subtle directional reflections",
    lightingSetup: "Warm afternoon window light as key from the right, ambient grey wall bounce as fill, gentle rim highlight from window reflections",
    styleReference: "the warm sophisticated aesthetic of Elle Decoration UK editorial photography",
    lensSpec: "Shot with a 50mm lens at f/4",
    atmosphere: "warm, sophisticated afternoon with golden undertones",
  },
  cozy_british: {
    mood: "rich, traditional, and quintessentially British",
    contextAnchor: "a feature spread from Country Life magazine or Homes and Gardens",
    roomDescription: "a classic British drawing room with a traditional marble fireplace on the left wall, a gilt mirror hanging above it, and tall sash windows with floor-length velvet curtains in deep burgundy",
    wallDescription: "Cream-painted walls with traditional picture rail moulding and a warm patina that suggests heritage and warmth",
    flooring: "dark oak parquet laid in a herringbone pattern, partially covered by a traditional Persian rug with deep reds and navy",
    flooringDirection: "with herringbone pattern angled from the front-left to rear-right",
    lightSource: "Tall sash windows with natural daylight mixing with warm amber firelight from the fireplace",
    lightQuality: "a rich blend of cool window daylight and warm fireplace glow",
    lightDirection: "Natural light from the RIGHT through sash windows, warm fire glow from the LEFT fireplace",
    shadowDirection: "Warm layered shadows with complex depth from the dual light sources, firelight creating soft pools on the rug",
    propsPositioned: "Leather-bound books arranged on built-in shelves in the rear-left alcove. A silver tea service placed on an occasional table to the right. Fresh flowers in a crystal vase on the mantelpiece. Velvet cushions in deep jewel tones scattered appropriately",
    materialBehavior: "The dark oak parquet shows subtle reflections from the window light while the Persian rug absorbs light with rich colour saturation",
    lightingSetup: "Dual key lighting from window daylight and warm fireplace glow, ambient bounce from cream walls, subtle highlights on silver and crystal objects",
    styleReference: "the warm traditional aesthetic of Country Life magazine interior photography",
    lensSpec: "Shot with a 50mm lens at f/4",
    atmosphere: "rich, warm, and inviting British country house in late afternoon",
  },
  luxury_penthouse: {
    mood: "glamorous, aspirational, and urban-luxe",
    contextAnchor: "a feature in Architectural Digest showcasing a London penthouse at golden hour",
    roomDescription: "a luxury penthouse apartment with floor-to-ceiling panoramic windows revealing a city skyline bathed in golden hour light, creating dramatic long shadows across the interior",
    wallDescription: "Minimal white walls with floor-to-ceiling glass creating an expansive open feel against the city backdrop",
    flooring: "polished Italian Calacatta marble with subtle gold veining",
    flooringDirection: "with veining running diagonally across the floor, catching and reflecting the golden light",
    lightSource: "Golden hour sunlight streaming through panoramic floor-to-ceiling windows",
    lightQuality: "dramatic golden-hour light with rich warm tones and defined highlights",
    lightDirection: "positioned on the LEFT through the panoramic windows",
    shadowDirection: "Long dramatic golden shadows stretch to the RIGHT across the marble floor, with warm light creating specular highlights on the polished marble surface",
    propsPositioned: "A sculptural designer floor lamp positioned rear-right casting a warm pool of accent light. A curated contemporary art piece on the far wall. A champagne-toned accent table with a design book placed nearby",
    materialBehavior: "The polished marble floor creates clear reflections of the furniture and golden light, showing realistic specular highlights where the angle catches the veining",
    lightingSetup: "Dramatic golden-hour key light from the left panoramic windows, marble floor acting as a natural reflector providing fill from below, rim light from sky glow separating furniture from the cityscape",
    styleReference: "the dramatic luxury of Architectural Digest penthouse editorial photography",
    lensSpec: "Shot with a 24mm wide-angle lens at f/5.6",
    atmosphere: "glamorous urban golden hour with city skyline backdrop",
  },
  minimalist_white: {
    mood: "pure, stark, and gallery-like",
    contextAnchor: "a minimalist interior photograph from Cereal magazine",
    roomDescription: "a pure minimalist interior with stark white walls and a single large window providing bold directional light, creating a gallery-like space where the furniture is the sole focal point",
    wallDescription: "Pure white walls with a completely clean matte finish, creating a gallery-like negative space around the furniture",
    flooring: "light polished concrete with a subtle sheen",
    flooringDirection: "with a seamless uniform surface reflecting soft directional light from the window",
    lightSource: "A single large window",
    lightQuality: "stark clean directional light creating bold contrast between illuminated and shadowed areas",
    lightDirection: "positioned on the LEFT side of the room",
    shadowDirection: "Clean defined shadows fall sharply to the RIGHT, creating bold graphic contrast on the polished concrete floor",
    propsPositioned: "A completely empty room with only the furniture as the focal point and perhaps a single geometric object placed at a deliberate distance to provide scale",
    materialBehavior: "The polished concrete floor catches a subtle reflection of the furniture base, grounding it with realistic weight against the stark environment",
    lightingSetup: "Single directional key light from the left window creating bold shadow contrast, minimal fill allowing deep shadow areas, no artificial lighting",
    styleReference: "the stark minimalist aesthetic of Cereal magazine photography",
    lensSpec: "Shot with a 35mm lens at f/8 for maximum sharpness throughout",
    atmosphere: "stark, pure, and contemplative minimalism",
  },

  // ═══════════ BEDROOM ═══════════
  serene_bedroom: {
    mood: "peaceful, soft, and sanctuary-like",
    contextAnchor: "a product photograph from The White Company bedroom catalogue",
    roomDescription: "a serene bedroom sanctuary with soft white walls and gentle morning light filtering through lightweight linen curtains, creating an ethereal dreamy atmosphere with layered white bedding",
    wallDescription: "Soft white walls with a warm undertone that glows gently in the morning light",
    flooring: "plush cream carpet",
    flooringDirection: "with a deep soft pile that shows subtle directional texture from the furniture's placement",
    lightSource: "Lightweight linen curtains diffusing gentle morning sunlight",
    lightQuality: "soft dreamy morning light with a warm golden glow",
    lightDirection: "positioned on the RIGHT side of the room",
    shadowDirection: "Very soft diffused shadows fall gently to the LEFT with minimal contrast, creating an ethereal quality throughout",
    propsPositioned: "Layered white and cream textiles arranged naturally on nearby surfaces. A ceramic bedside lamp with a warm linen shade placed on the left. A small clear glass vase with dried eucalyptus stems on a bedside table",
    materialBehavior: "The plush carpet compresses subtly under the furniture weight, showing realistic contact points where the furniture meets the floor",
    lightingSetup: "Soft diffused morning light as gentle key from the right, warm ambient fill bouncing from cream walls and textiles, no harsh shadows anywhere",
    styleReference: "the dreamy aspirational photography of The White Company brand campaigns",
    lensSpec: "Shot with a 50mm lens at f/2.8 for gentle background softness",
    atmosphere: "peaceful dreamy morning sanctuary",
  },
  boutique_hotel: {
    mood: "moody, luxurious, and intimate",
    contextAnchor: "a boutique hotel interior feature in Condé Nast Traveller",
    roomDescription: "a boutique hotel room with dark forest green walls creating an intimate cocoon, warm brass pendant lights casting pools of golden light, and rich velvet textures throughout",
    wallDescription: "Dark forest green walls with a subtle matte finish that absorbs light and creates an intimate moody atmosphere",
    flooring: "dark herringbone timber partially covered by a plush deep-pile area rug",
    flooringDirection: "with herringbone pattern running from rear to front, catching warm pendant light at its edges",
    lightSource: "Warm brass pendant lights hanging from above",
    lightQuality: "moody warm atmospheric lighting with brass-toned golden highlights",
    lightDirection: "positioned directly ABOVE casting downward pools of warm light",
    shadowDirection: "Dramatic pools of warm golden light on surfaces directly below pendants, with deep atmospheric shadows in the room's corners and edges",
    propsPositioned: "Velvet cushions in deep jewel tones of emerald and sapphire arranged naturally. A brass-framed mirror leaning against the rear wall reflecting warm light. A stack of art books placed on a side surface to the left. A cashmere throw draped with deliberate casualness",
    materialBehavior: "The dark green walls absorb most light creating rich depth while the brass fixtures produce warm specular highlights that punctuate the moody scene",
    lightingSetup: "Warm brass pendant as overhead key light, subtle ambient uplighting from concealed sources, deep shadow contrast in corners creating intimate atmosphere",
    styleReference: "the moody luxurious aesthetic of Condé Nast Traveller hotel interior photography",
    lensSpec: "Shot with a 35mm lens at f/2.8 for atmospheric shallow depth of field",
    atmosphere: "moody intimate boutique hotel evening",
  },
  light_airy: {
    mood: "fresh, coastal, and relaxed",
    contextAnchor: "a bedroom feature in Living Etc magazine showcasing coastal style",
    roomDescription: "a light and airy bedroom with white shiplap walls creating horizontal texture, abundant natural light streaming through multiple windows, and natural rattan and linen accents suggesting relaxed coastal living",
    wallDescription: "White shiplap walls with visible horizontal plank lines that add subtle texture and a coastal character",
    flooring: "bleached oak floorboards",
    flooringDirection: "with wide planks running left to right showing natural grain variation in the bright light",
    lightSource: "Multiple windows allowing abundant natural daylight to flood the space",
    lightQuality: "bright high-key natural light creating a fresh sun-washed coastal feel",
    lightDirection: "positioned on both the LEFT and RIGHT sides of the room",
    shadowDirection: "Light airy shadows with high-key brightness throughout, minimal shadow contrast creating an open breezy atmosphere",
    propsPositioned: "A woven rattan basket placed on the floor rear-right of the frame. Trailing pothos plants cascading from a shelf in the background. Linen textiles in natural oatmeal tones draped softly. A piece of natural driftwood placed as an accent on a surface",
    materialBehavior: "The bleached oak floors reflect bright light with a natural matte warmth while the rattan textures catch side light showing woven detail",
    lightingSetup: "Bright even natural daylight from multiple windows as omnidirectional key, minimal shadow fill needed due to high-key lighting, subtle warm bounce from oak floors",
    styleReference: "the bright relaxed coastal aesthetic of Living Etc bedroom photography",
    lensSpec: "Shot with a 35mm lens at f/4",
    atmosphere: "bright fresh coastal morning with sun-washed openness",
  },

  // ═══════════ DINING ═══════════
  modern_dining: {
    mood: "sociable, warm, and contemporary",
    contextAnchor: "a dining collection campaign photograph for Heal's furniture",
    roomDescription: "a modern dining space anchored by a statement pendant light hanging directly above the table area, with large windows opening to a garden view that brings natural greenery into the scene",
    wallDescription: "Clean contemporary white walls with a subtle warm undertone",
    flooring: "dark oak engineered wood",
    flooringDirection: "with long planks running from front to back, creating visual depth in the composition",
    lightSource: "A statement pendant light hanging above combined with natural window light from the side",
    lightQuality: "warm pendant glow combined with cool natural window light creating dimensional two-tone lighting",
    lightDirection: "Pendant light directly ABOVE, natural window light from the LEFT side",
    shadowDirection: "Defined downward shadows from the pendant light directly below objects, with softer side-fill shadows from the left window creating subtle depth and dimension",
    propsPositioned: "White tableware arranged as if set for an intimate dinner on the table surface. Linen napkins folded with understated elegance. A ceramic jug with fresh greenery placed at the table centre. Simple dining chairs positioned naturally around",
    materialBehavior: "The dark oak floor shows rich grain detail in the pendant's downward light while the white tableware creates bright contrast against the darker wood tones",
    lightingSetup: "Warm pendant overhead as primary key, cool natural window light from left as secondary fill, ambient bounce from white walls and tableware",
    styleReference: "the warm contemporary aesthetic of Heal's lifestyle campaign photography",
    lensSpec: "Shot with a 24mm wide-angle lens at f/5.6",
    atmosphere: "warm sociable contemporary dining at early evening",
  },
  rustic_farmhouse: {
    mood: "honest, warm, and full of countryside charm",
    contextAnchor: "a feature in Country Homes and Interiors magazine",
    roomDescription: "a rustic farmhouse dining room with exposed ceiling beams showing natural aged timber, whitewashed walls with gentle texture, and vintage character throughout that suggests generations of family meals",
    wallDescription: "Whitewashed rough plaster walls with gentle texture and subtle imperfections that convey authentic farmhouse character",
    flooring: "reclaimed wide-plank timber",
    flooringDirection: "with broad planks showing natural knots and patina running from left to right",
    lightSource: "A farmhouse window with natural light combined with a vintage pendant light hanging above the table",
    lightQuality: "warm rustic lighting mixing soft natural window daylight with amber vintage pendant glow",
    lightDirection: "Natural light from the RIGHT through a farmhouse window, pendant light from ABOVE",
    shadowDirection: "Warm textured shadows with ceiling beam patterns casting across the table surface, creating an authentic interplay of natural and pendant light",
    propsPositioned: "A linen table runner laid along the table centre. A ceramic pitcher filled with freshly gathered wildflowers placed at the centre. Mismatched vintage chairs positioned around the table with natural casualness. A wooden bread board with an artisan loaf placed nearby",
    materialBehavior: "The reclaimed timber floor absorbs light warmly showing rich patina and age marks while the whitewashed walls diffuse light softly throughout the room",
    lightingSetup: "Dual key lighting from farmhouse window daylight and warm pendant overhead, soft ambient bounce from whitewashed walls, beam shadow patterns adding texture",
    styleReference: "the authentic warm aesthetic of Country Homes and Interiors editorial photography",
    lensSpec: "Shot with a 35mm lens at f/4",
    atmosphere: "honest warm countryside farmhouse with afternoon light",
  },

  // ═══════════ OFFICE ═══════════
  modern_office: {
    mood: "productive, clean, and inspiring",
    contextAnchor: "a home office collection photograph for John Lewis Home",
    roomDescription: "a modern home office with clean white walls creating a focused productive atmosphere, a large window providing bright desk-side natural light, and built-in shelving on one wall displaying curated objects",
    wallDescription: "Clean white walls with a crisp finish that maximises the natural light reflection throughout the workspace",
    flooring: "light timber or clean light-toned carpet",
    flooringDirection: "with a uniform clean appearance that keeps the focus on the furniture and workspace",
    lightSource: "A large desk-side window",
    lightQuality: "bright focused natural daylight ideal for a productive workspace atmosphere",
    lightDirection: "positioned on the LEFT side, illuminating the desk area directly",
    shadowDirection: "Clean defined shadows from the left window light fall to the RIGHT across the desk area, providing natural dimension without harsh contrast",
    propsPositioned: "Neatly arranged books on the built-in shelving to the right wall. A small potted plant in a minimalist pot placed on the desk surface. A designer desk lamp positioned for task lighting. Minimal desk accessories arranged with deliberate tidiness",
    materialBehavior: "The light timber floor provides a warm neutral base that reflects gentle light upward while the desk surface shows subtle reflections from the window",
    lightingSetup: "Bright natural window light from the left as primary key, ambient bounce from white walls as fill, designer lamp providing warm accent task light",
    styleReference: "the clean aspirational aesthetic of John Lewis Home campaign photography",
    lensSpec: "Shot with a 35mm lens at f/5.6",
    atmosphere: "bright productive modern workspace in clear morning light",
  },
  creative_studio: {
    mood: "inspiring, artistic, and industrially chic",
    contextAnchor: "a creative workspace feature in Dezeen or Monocle magazine",
    roomDescription: "a creative studio space with white brick walls creating industrial texture, large factory-style industrial windows letting in abundant natural light, and an inspiring artistic atmosphere with curated creative objects",
    wallDescription: "White-painted brick walls with visible mortar lines and industrial texture that catches side light beautifully",
    flooring: "polished concrete",
    flooringDirection: "with a seamless industrial surface showing subtle tonal variation and a gentle sheen from the window light",
    lightSource: "Large factory-style industrial windows with metal frames",
    lightQuality: "bright even industrial daylight with warm task-light accents",
    lightDirection: "positioned on the LEFT side through large industrial windows",
    shadowDirection: "Industrial window-frame shadow patterns fall across the floor to the RIGHT, with bright even fill throughout the space",
    propsPositioned: "Mood boards and inspiration pinned to the rear brick wall in an artful arrangement. Trailing green plants cascading from shelves positioned rear-right. A warm-toned desk lamp providing accent task lighting. Art supplies and creative materials arranged with studied casualness",
    materialBehavior: "The polished concrete floor shows subtle reflections of the industrial window light while the white brick walls create textured shadow patterns as the light grazes across them",
    lightingSetup: "Bright industrial window light from the left as key, even bounce from white brick as fill, warm desk lamp as accent creating a creative focal point",
    styleReference: "the inspiring industrial aesthetic of Monocle workspace editorial photography",
    lensSpec: "Shot with a 24mm wide-angle lens at f/4",
    atmosphere: "inspiring bright industrial creative space",
  },

  // ═══════════ STUDIO / PRODUCT ═══════════
  white_background: {
    mood: "clean, professional, and product-focused",
    contextAnchor: "a pure e-commerce product photograph for a premium retailer website like John Lewis or Selfridges",
    roomDescription: "a pure white studio background at RGB 255 255 255 with perfectly even shadowless lighting from multiple softboxes positioned around the product, filling 85 percent of the frame with the furniture perfectly centred and no visible environment or floor line",
    wallDescription: "Pure seamless white background with absolutely no visible edges, corners, or horizon lines",
    flooring: "seamless white infinity curve",
    flooringDirection: "that sweeps continuously from floor to background with no visible join or shadow line",
    lightSource: "Multiple professional studio softboxes",
    lightQuality: "perfectly even multi-point studio lighting eliminating all directional shadows",
    lightDirection: "positioned ALL AROUND the product from front, sides, and above",
    shadowDirection: "A completely empty white space with absolutely no directional shadows and even illumination from all angles",
    propsPositioned: "Absolutely nothing else in the frame. A completely empty pure white environment with only the furniture product visible",
    materialBehavior: "Every material on the furniture is evenly lit revealing true colour and texture without any directional shadow bias",
    lightingSetup: "Professional multi-point studio softbox setup with key, fill, hair, and background lights creating zero-shadow product illumination",
    styleReference: "premium e-commerce product photography standards for marketplace listings",
    lensSpec: "Shot with an 85mm lens at f/11 for maximum sharpness edge to edge",
    atmosphere: "clinical professional studio product shot",
  },
  grey_studio: {
    mood: "professional, refined, and studio-quality",
    contextAnchor: "a professional furniture product photograph for a premium printed catalogue",
    roomDescription: "a seamless medium grey studio background with professional three-point lighting creating dimensional product photography, with the key light from the upper left, fill light from the right, and a backlight providing rim separation",
    wallDescription: "Seamless medium grey backdrop with no visible edges or horizon lines",
    flooring: "seamless grey studio backdrop",
    flooringDirection: "that sweeps continuously from floor to background in a smooth grey curve",
    lightSource: "Professional three-point lighting rig with key, fill, and backlight",
    lightQuality: "professional studio lighting creating dimensional highlights and controlled shadows",
    lightDirection: "Key light from the UPPER-LEFT, fill from the RIGHT, backlight from BEHIND",
    shadowDirection: "Defined key shadow falls to the RIGHT with softened edges from the fill light, a rim highlight behind separates the furniture from the grey background",
    propsPositioned: "A completely empty studio environment with only the furniture product visible against the grey backdrop",
    materialBehavior: "The three-point lighting reveals every material texture with dimensional highlights on curved surfaces and controlled shadow depth in recesses",
    lightingSetup: "Classic three-point studio setup with key light upper-left creating form, fill light from right softening shadows, backlight providing rim separation and depth",
    styleReference: "high-end furniture catalogue product photography with museum-quality lighting",
    lensSpec: "Shot with an 85mm lens at f/8 for optimal sharpness",
    atmosphere: "professional refined studio photography",
  },
  showroom_floor: {
    mood: "contextual, premium, and showroom-realistic",
    contextAnchor: "an in-situ showroom photograph for a premium furniture retailer like Ligne Roset or B and B Italia",
    roomDescription: "a polished concrete showroom floor with professional track lighting from the ceiling creating focused highlights on the furniture, with other furniture pieces visible but tastefully blurred in the background suggesting a curated showroom environment",
    wallDescription: "A minimal showroom backdrop with other furniture forms visible as soft blurred shapes suggesting a curated retail environment",
    flooring: "polished concrete showroom floor",
    flooringDirection: "with a smooth surface showing subtle reflections of the furniture and track lighting above",
    lightSource: "Professional ceiling-mounted track lighting",
    lightQuality: "focused directional track lighting creating defined highlights and dimensional shadows on the product",
    lightDirection: "positioned ABOVE on ceiling-mounted tracks",
    shadowDirection: "Defined downward shadows directly beneath the furniture from the overhead track spots, with gentle reflections in the polished concrete floor",
    propsPositioned: "Blurred companion furniture pieces visible in the background at varying distances, suggesting a thoughtfully curated showroom display without distracting from the hero piece",
    materialBehavior: "The polished concrete floor creates soft reflections of the furniture base grounding it with visual weight, while the track lights produce defined specular highlights on any glossy or metallic furniture elements",
    lightingSetup: "Professional overhead track lighting as key creating defined pools of light, ambient showroom fill from reflected light, background naturally darker drawing focus to the hero piece",
    styleReference: "premium furniture showroom photography with shallow depth of field and retail atmosphere",
    lensSpec: "Shot with a 50mm lens at f/2.8 for shallow depth of field that softens the background showroom",
    atmosphere: "premium curated showroom floor display",
  },
};

// ── Build room lock text from stored room_lock data ──
function buildRoomLockPrompt(roomLock: RoomLock, batchIndex: number, batchTotal: number): string {
  return `BATCH CONSISTENCY: This is image ${batchIndex + 1} of ${batchTotal}. Use IDENTICAL room environment as image 1: ${roomLock.room_template} room, ${roomLock.wall_color}, ${roomLock.floor} ${roomLock.floor_direction}, ${roomLock.light_source} ${roomLock.light_direction} casting ${roomLock.light_quality}, shadows falling ${roomLock.shadow_direction}, props in exact positions: ${roomLock.props.join(", ")}, with ${roomLock.atmosphere} atmosphere. Only the furniture product changes.`;
}

// ── Batch consistency prefix ──
function buildBatchConsistencyPrefix(
  batchInfo: { index: number; total: number; label?: string } | null,
  config: TemplateConfig | null,
  roomLock: RoomLock | null
): string {
  if (!batchInfo || batchInfo.total <= 1) return "";

  // For image 2+ with a stored room_lock, use that for exact matching
  if (batchInfo.index > 0 && roomLock) {
    const labelHint = batchInfo.label?.toLowerCase() || "";
    const isCloseUp = labelHint.includes("close") || labelHint.includes("detail") || labelHint.includes("fabric") || labelHint.includes("texture");

    let prefix = buildRoomLockPrompt(roomLock, batchInfo.index, batchInfo.total);

    if (isCloseUp) {
      prefix += `\n\nThis is a close-up detail shot. Show partial room environment with the same ${roomLock.floor} visible at edges, same ${roomLock.light_source} direction creating consistent lighting, same ${roomLock.atmosphere} atmosphere. Background softly out of focus but clearly recognisable as the same room.`;
    }

    return prefix + "\n\n";
  }

  // For image 1, establish the room
  if (config) {
    return `BATCH CONSISTENCY REQUIREMENT: This is image 1 of ${batchInfo.total} in a product set. ALL images in this set must appear as if photographed in the EXACT SAME ROOM during the SAME photoshoot session. This is the HERO image that establishes the room environment precisely.

Maintain identical room layout, architecture, wall colours, flooring, lighting setup, light direction, shadow angles, colour temperature, mood, background props in same positions, and time of day atmosphere across the entire set. The ONLY difference between images should be the furniture product itself.

`;
  }

  return "";
}

// ── Build a full C.S.S.T. prompt (Nano Banana Pro framework) ──
function buildTemplatePrompt(
  config: TemplateConfig,
  aspectRatio: string,
  resolution: string,
  cameraAngle: string | null,
  batchInfo: { index: number; total: number; label?: string } | null = null,
  roomLock: RoomLock | null = null
): string {
  const angleInstruction = cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]
    ? CAMERA_ANGLE_PROMPTS[cameraAngle]
    : "The camera is positioned at eye level, looking straight on at the furniture piece.";

  const batchPrefix = buildBatchConsistencyPrefix(batchInfo, config, roomLock);
  const imperfections = pickImperfections(2);

  return `${batchPrefix}[CONTEXT]: This is a premium furniture e-commerce photograph for a UK retailer website. The tone is ${config.mood}. Think of it as ${config.contextAnchor}.

[SUBJECT & LOGIC]: Place this exact furniture piece naturally in ${config.roomDescription}. The furniture sits on ${config.flooring} ${config.flooringDirection}. ${config.wallDescription}. ${config.lightSource} ${config.lightDirection} casts ${config.lightQuality} across the scene. ${config.shadowDirection}. Include ${config.propsPositioned}. The furniture appears grounded with realistic contact shadows where the base meets the floor, showing subtle compression and contact points. ${config.materialBehavior}. Scale is accurate for a real interior space. ${angleInstruction}

[STYLE]: Photorealistic commercial interior photography. ${config.lightingSetup}. The furniture materials interact with light realistically: ${config.materialBehavior}. Reference: ${config.styleReference}.

[TECHNICAL FLAVOR]: ${config.lensSpec}. ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: ${resolution || "1k"}.`;
}

// ── Build a C.S.S.T. prompt from a custom user description ──
function buildCustomPrompt(
  userInput: string,
  aspectRatio: string,
  resolution: string,
  cameraAngle: string | null,
  batchInfo: { index: number; total: number; label?: string } | null = null,
  roomLock: RoomLock | null = null
): string {
  const angleInstruction = cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]
    ? CAMERA_ANGLE_PROMPTS[cameraAngle]
    : "";

  const batchPrefix = buildBatchConsistencyPrefix(batchInfo, null, roomLock);
  const imperfections = pickImperfections(2);

  return `${batchPrefix}[CONTEXT]: This is a premium furniture e-commerce photograph for a UK retailer website. The tone is aspirational and lifestyle-focused. Think of it as a hero image from a premium furniture retailer catalogue.

[SUBJECT & LOGIC]: Place this exact furniture piece naturally in ${userInput}. The furniture appears grounded with realistic contact shadows where the base meets the floor. Shadows fall correctly based on visible light sources in the scene. Scale is accurate for a real interior space. ${angleInstruction}

[STYLE]: Photorealistic commercial interior photography. Natural lighting that accurately represents furniture materials with realistic surface interactions. Reference: high-end British furniture retail photography.

[TECHNICAL FLAVOR]: Shot with a 35mm lens at f/4. ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: ${resolution || "1k"}.`;
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

    const { image_id, template_id, resolution, custom_prompt, aspect_ratio, camera_angle, set_id, label, batch_index, batch_total, room_lock } = await req.json();

    // Build batch info if present
    const batchInfo = typeof batch_index === "number" && typeof batch_total === "number" && batch_total > 1
      ? { index: batch_index, total: batch_total, label: label || undefined }
      : null;

    // Get room_lock for batch images 2+
    const roomLockData: RoomLock | null = room_lock || null;

    // Build prompt using C.S.S.T. framework (Nano Banana Pro)
    let prompt: string;
    const templateConfig = TEMPLATES[template_id];
    if (template_id === "custom" && custom_prompt) {
      prompt = buildCustomPrompt(custom_prompt, aspect_ratio, resolution, camera_angle, batchInfo, roomLockData);
    } else if (templateConfig) {
      prompt = buildTemplatePrompt(templateConfig, aspect_ratio, resolution, camera_angle, batchInfo, roomLockData);
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

    // Determine MIME type from filename
    const mimeType = imageRecord.filename?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    console.log("Calling AI gateway with template:", template_id, "| Batch:", batchInfo ? `${batchInfo.index + 1}/${batchInfo.total}` : "single", "| Prompt length:", prompt.length);

    // ── API CALL STRUCTURE (Nano Banana Pro) ──
    // 1. Text: Product preservation instruction FIRST
    // 2. Image: Furniture image as base64 reference
    // 3. Text: Full C.S.S.T. prompt describing the room/scene
    // Temperature: 0.3 (lower = more faithful to reference)
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
                // STEP 1: Preservation instruction FIRST
                {
                  type: "text",
                  text: `${PRODUCT_PRESERVATION}\n\nCRITICAL: Preserve this EXACT furniture product unchanged. Only place it in a new environment.`,
                },
                // STEP 2: The furniture image as PRIMARY reference
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
                // STEP 3: The full C.S.S.T. room/scene prompt
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
          modalities: ["image", "text"],
          temperature: 0.3,
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

    // Build room_lock for first batch image so client can pass it to subsequent calls
    let generatedRoomLock: RoomLock | null = null;
    if (batchInfo && batchInfo.index === 0 && templateConfig) {
      generatedRoomLock = extractRoomLock(template_id, templateConfig);

      // Store room_lock in product_sets if set_id provided
      if (set_id) {
        await supabaseAdmin
          .from("product_sets")
          .update({ room_lock: generatedRoomLock } as any)
          .eq("id", set_id);
      }
    }

    console.log("Generation complete. Job:", job.id, batchInfo ? `(batch ${batchInfo.index + 1}/${batchInfo.total})` : "");

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        output_url: signedUrl?.signedUrl || null,
        credits_remaining: profile.credits_remaining - creditsNeeded,
        room_lock: generatedRoomLock,
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
