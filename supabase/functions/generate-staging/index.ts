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
  eye_level: "The camera is positioned at eye level, looking straight on at the furniture piece, creating a direct and honest perspective that a customer would see in a showroom.",
  standard: "The camera is positioned at eye level, looking straight on at the furniture piece, creating a direct and honest perspective that a customer would see in a showroom.",
  elevated: "The camera is positioned slightly above at approximately a 30-degree downward angle, revealing the top surface and front of the furniture in a classic three-quarter overhead view.",
  low_angle: "The camera is positioned low to the ground, angled upward toward the furniture, making it appear grand and substantial with an aspirational quality.",
  side_profile: "The camera is positioned at a precise 90-degree side angle, capturing the full silhouette profile of the furniture piece against the room environment.",
  corner_view: "The camera is positioned at a 45-degree angle showing both the front face and one side of the furniture, creating a dimensional three-quarter view.",
};

// ── View-specific prompts for batch editing (images 2+) ──
// ── Shot-type definitions: framing instruction + dedicated prompt builder ──
interface ShotType {
  framing: string;
  buildPrompt: (roomConfig: TemplateConfig | null) => string;
}

const SHOT_TYPES: Record<string, ShotType> = {
  "full product": {
    framing: "Full catalog view showing the entire piece. Furniture centered, fills approximately 60 percent of the frame. Full room environment visible around it.",
    buildPrompt: (cfg) => cfg
      ? `Place this exact furniture in the room. Full catalog view showing the entire piece. Furniture centered, fills approximately 60 percent of the frame. Full room environment visible. ${cfg.wallDescription}. ${cfg.flooring} ${cfg.flooringDirection} floor visible. ${cfg.lightSource} casting ${cfg.lightQuality}. ${cfg.propsPositioned}.`
      : "Place this exact furniture in the room. Full catalog view showing the entire piece. Furniture centered, fills approximately 60 percent of the frame. Full room environment visible.",
  },
  "3/4 angle": {
    framing: "Same 3/4 angle as the reference image. Furniture at a 45-degree angle showing front and one side. Room visible but furniture is the hero.",
    buildPrompt: (cfg) => cfg
      ? `Place this exact furniture at a 45-degree three-quarter angle showing both the front face and one side, matching the reference image angle. The furniture is the hero of the shot with the room providing context. ${cfg.wallDescription}. ${cfg.flooring} floor visible. ${cfg.lightSource} casting ${cfg.lightQuality}.`
      : "Place this exact furniture at a 45-degree three-quarter angle showing both the front face and one side. Room visible but furniture is the hero.",
  },
  "side view": {
    framing: "90-degree side profile matching the reference image. Full side of the furniture visible.",
    buildPrompt: (cfg) => cfg
      ? `Place this exact furniture showing its full 90-degree side profile, matching the reference angle. The complete side silhouette is visible. ${cfg.wallDescription} visible behind. ${cfg.flooring} ${cfg.flooringDirection} floor visible beneath. ${cfg.lightSource} casting ${cfg.lightQuality}.`
      : "Place this exact furniture showing its full 90-degree side profile. Room stays identical.",
  },
  "back view": {
    framing: "Back of the furniture visible, rotated 180 degrees from front. Same room position.",
    buildPrompt: (cfg) => cfg
      ? `Place this exact furniture showing its back, rotated 180 degrees from front view, in the same room position. The rear design, any back panel detail, and construction are visible. ${cfg.wallDescription} visible. ${cfg.flooring} floor beneath.`
      : "Place this exact furniture showing its back, rotated 180 degrees from front. Room stays identical.",
  },
  "close-up: arm": {
    framing: "Close-up shot tightly framing the armrest area. Arm fills approximately 70 percent of the frame. Room visible as soft blurred background.",
    buildPrompt: (cfg) => {
      const room = cfg ? `Background shows ${cfg.wallDescription.toLowerCase()} wall softly out of focus. ${cfg.flooring} floor partially visible at the bottom edge. Lighting from ${cfg.lightDirection} consistent with the room template. Same ${cfg.atmosphere} mood and colour temperature.` : "Room visible as soft blurred background with same lighting direction.";
      return `Close-up shot focusing on the armrest of this furniture IN the room setting. Frame tightly on the arm area so the arm fills approximately 70 percent of the frame. PRESERVE the exact arm shape, curves, stitching, and fabric texture from the reference image. ${room} Shallow depth of field at f/2.8 equivalent.`;
    },
  },
  "close-up: seat": {
    framing: "Close-up of the seat/cushion area. Seat fills approximately 70 percent of the frame. Room visible as soft blurred background.",
    buildPrompt: (cfg) => {
      const room = cfg ? `Background shows ${cfg.wallDescription.toLowerCase()} softly out of focus. ${cfg.flooring} floor partially visible. Lighting from ${cfg.lightDirection}. Same ${cfg.atmosphere} mood.` : "Room visible as soft blurred background.";
      return `Close-up shot focusing on the seat and cushion area of this furniture IN the room setting. Frame tightly so the seat fills approximately 70 percent of the frame. PRESERVE exact cushion shape, fabric texture, any piping or stitching from the reference. ${room} Shallow depth of field at f/2.8 equivalent.`;
    },
  },
  "close-up: leg": {
    framing: "Close-up of legs/base. Leg and lower furniture fills the frame. Room floor CLEARLY visible with contact shadow.",
    buildPrompt: (cfg) => {
      const room = cfg ? `${cfg.flooring} ${cfg.flooringDirection} floor clearly visible with a realistic contact shadow where the leg meets the floor. ${cfg.wallDescription} wall visible in the soft background. Lighting consistent with ${cfg.lightDirection}.` : "Room floor clearly visible with contact shadow. Wall visible in soft background.";
      return `Close-up shot of the furniture leg and base area IN the room setting. Frame tightly on the leg and lower body so it fills the majority of the frame. PRESERVE the exact leg shape, material, finish, and any hardware from the reference image. ${room} Show realistic contact where the leg meets the floor.`;
    },
  },
  "close-up: fabric": {
    framing: "Extreme close-up of fabric texture. Fabric fills 90 percent of the frame. Very shallow depth of field. Hint of room in background.",
    buildPrompt: (cfg) => {
      const room = cfg ? `Lighting colour temperature matches the ${cfg.atmosphere} room template. Tiny hint of ${cfg.wallDescription.toLowerCase()} colour in any soft background blur.` : "Hint of room lighting and colour temperature in background.";
      return `Extreme close-up of the fabric texture of this furniture, macro-style shot IN the room setting. Fabric fills 90 percent of the frame. PRESERVE the exact fabric weave, texture, colour, and any stitching from the reference image. Very shallow depth of field. ${room}`;
    },
  },
  "close-up: detail": {
    framing: "Tight detail shot of buttons, stitching, hardware, or mechanisms. Detail centered and fills majority of frame.",
    buildPrompt: (cfg) => {
      const room = cfg ? `Lighting direction from ${cfg.lightDirection}. Soft room ambiance of ${cfg.atmosphere} in minimal visible background.` : "Professional product detail photography lighting.";
      return `Tight detail shot of the buttons, stitching, or hardware visible in this furniture reference image, IN the room setting. Detail centered and fills the majority of the frame. PRESERVE every element exactly as shown in the reference. Surrounding fabric and material matches the reference exactly. ${room} Professional product detail photography style.`;
    },
  },
  "feature: reclined": {
    framing: "Furniture shown in reclined/extended position matching the reference. Full or 3/4 view.",
    buildPrompt: (cfg) => cfg
      ? `Show this furniture in its reclined position in the room, matching the EXACT mechanism state from the reference image. PRESERVE the exact position of the recline mechanism. Full view showing the entire piece in its functional configuration. ${cfg.wallDescription}. ${cfg.flooring} floor. ${cfg.lightSource} casting ${cfg.lightQuality}. ${cfg.propsPositioned}.`
      : "Show this furniture in its reclined position matching the reference. Full view in the room.",
  },
  "feature: extended": {
    framing: "Furniture shown in extended/opened position matching the reference.",
    buildPrompt: (cfg) => cfg
      ? `Show this furniture in its extended or opened position in the room, matching the EXACT configuration from the reference image. PRESERVE the exact mechanism position. ${cfg.wallDescription}. ${cfg.flooring} floor. ${cfg.lightSource} casting ${cfg.lightQuality}.`
      : "Show this furniture in its extended position matching the reference. Full view in the room.",
  },
  "top view": {
    framing: "Elevated angle looking down at the product. Room floor visible around it.",
    buildPrompt: (cfg) => cfg
      ? `Elevated angle looking directly down at the product. ${cfg.flooring} ${cfg.flooringDirection} floor visible around the product. ${cfg.lightSource} from ${cfg.lightDirection} casting light from the same direction.`
      : "Elevated angle looking directly down at the product. Room floor visible.",
  },
  "corner view": {
    framing: "45-degree three-quarter angle showing front and side. Same room, same position.",
    buildPrompt: (cfg) => cfg
      ? `45-degree three-quarter angle showing both the front face and one side of the product. Same room, same position as the original furniture. ${cfg.wallDescription}. ${cfg.flooring} floor. ${cfg.lightSource}.`
      : "45-degree three-quarter angle showing front and side. Same room, same position.",
  },
  "lifestyle": {
    framing: "Wide room shot with furniture as centrepiece, showing full styled environment with decor. Camera at standing eye level (150cm), 3-4 metres back.",
    buildPrompt: (cfg) => cfg
      ? `Wide establishing shot of the furniture as the centrepiece of ${cfg.roomDescription}. Camera at standing eye level (150cm), 3-4 metres back. Show surrounding decor, rugs, lamps, plants, artwork. ${cfg.wallDescription}. ${cfg.flooring} floor. ${cfg.lightSource} casting ${cfg.lightQuality}. ${cfg.propsPositioned}. The furniture occupies the central third of the frame with styled room context filling the rest.`
      : "Wide room shot showing the furniture as centrepiece in a fully styled living environment. Camera at standing eye level, 3-4 metres back, with surrounding decor visible.",
  },
};

function getShotType(label: string | undefined): ShotType {
  if (!label) return SHOT_TYPES["full product"];
  const key = label.toLowerCase().trim();
  // Exact match first
  if (SHOT_TYPES[key]) return SHOT_TYPES[key];
  // Partial match
  for (const [shotKey, shotType] of Object.entries(SHOT_TYPES)) {
    if (key.includes(shotKey) || shotKey.includes(key)) return shotType;
  }
  // Legacy label mapping
  if (key.includes("front")) return SHOT_TYPES["full product"];
  if (key.includes("fabric")) return SHOT_TYPES["close-up: fabric"];
  if (key.includes("close")) return SHOT_TYPES["close-up: detail"];
  if (key.includes("reclin")) return SHOT_TYPES["feature: reclined"];
  if (key.includes("extend")) return SHOT_TYPES["feature: extended"];
  // Fallback
  return {
    framing: `Match the angle and framing described as "${label}". The room stays identical.`,
    buildPrompt: (cfg) => `Place this product in the room matching the angle described as "${label}". ${cfg ? `${cfg.wallDescription}. ${cfg.flooring} floor. ${cfg.lightSource}.` : "Room stays identical."}`,
  };
}

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
    contextAnchor: "a hero shot from the Made.com catalogue",
    roomDescription: "a modern Scandinavian living room with white walls and floor-to-ceiling windows on the LEFT side allowing soft natural morning daylight to flood the space, creating an airy and aspirational atmosphere",
    wallDescription: "Clean white walls with a subtle matte texture that softly reflects the natural daylight",
    flooring: "light oak hardwood",
    flooringDirection: "with grain running left to right across the frame",
    lightSource: "Floor-to-ceiling windows on the LEFT side",
    lightQuality: "soft natural morning light",
    lightDirection: "positioned on the LEFT side of the room",
    shadowDirection: "Shadows fall gently to the RIGHT, with the furniture casting a soft diffused shadow on the floor matching the window light angle",
    propsPositioned: "A monstera plant in a white ceramic pot positioned in the rear-left of the frame. A grey wool rug beneath the furniture area. A simple oak side table with a small ceramic vase placed to the right",
    materialBehavior: "The oak floor catches a soft natural reflection from the window light, grounding the furniture with realistic weight",
    lightingSetup: "Soft diffused window light as key from the left, gentle ambient fill bouncing from the white walls, subtle rim light separating furniture from the background",
    styleReference: "the clean naturalistic look of Kinfolk magazine interior photography",
    lensSpec: "Shot with a 35mm lens at f/4. Subtle depth of field softening the background. Gentle grain visible in the shadow areas",
    atmosphere: "bright, airy, and aspirational Scandinavian morning",
  },
  contemporary_grey: {
    mood: "warm, sophisticated, and inviting",
    contextAnchor: "an interior spread from Elle Decoration UK",
    roomDescription: "a contemporary living room with warm grey walls in Farrow and Ball Pavilion Gray, engineered oak floor, and a large window on the RIGHT side with sheer linen curtains diffusing soft afternoon light",
    wallDescription: "Warm grey walls in a sophisticated Farrow and Ball Pavilion Gray tone with a subtle flat paint finish that absorbs light softly",
    flooring: "engineered oak",
    flooringDirection: "with planks running diagonally from rear-left to front-right",
    lightSource: "A large window with sheer linen curtains on the RIGHT side",
    lightQuality: "soft afternoon light with atmospheric haze near the window",
    lightDirection: "positioned on the RIGHT side of the room",
    shadowDirection: "Shadows fall softly to the LEFT with warm tones, creating gentle depth across the scene",
    propsPositioned: "A textured grey wool rug beneath the furniture area. A minimalist black floor lamp positioned in the background. A single abstract art piece hung on the wall behind",
    materialBehavior: "The textured rug absorbs light with no specular highlights while the engineered oak shows subtle directional reflections and the grey walls create a cocooning atmosphere",
    lightingSetup: "Soft afternoon window light from the right as key, ambient grey wall bounce as fill, gentle highlight roll-off on surfaces",
    styleReference: "the warm sophisticated aesthetic of Swedish photographer Pia Ulin",
    lensSpec: "Shot with a 50mm lens at f/2.8. Atmospheric haze near the window. Gentle highlight roll-off on surfaces",
    atmosphere: "warm, sophisticated afternoon with golden undertones",
  },
  cozy_british: {
    mood: "rich, traditional, and quintessentially British",
    contextAnchor: "a photograph from a National Trust property guidebook",
    roomDescription: "a classic British drawing room with warm cream walls showing plaster texture, dark oak herringbone parquet, and a marble fireplace on the RIGHT side with a gilt mirror hanging above it. Tall sash windows on the LEFT with floor-length deep green velvet curtains",
    wallDescription: "Warm cream walls with authentic plaster texture and subtle micro-variations in the aged paint surface",
    flooring: "dark oak herringbone parquet",
    flooringDirection: "with herringbone pattern angled from the front-left to rear-right, partially covered by a Persian rug beneath the furniture in deep reds and navy",
    lightSource: "Tall sash windows on the LEFT side mixed with warm ambient lamp glow",
    lightQuality: "late afternoon daylight through sash windows blending with warm lamp glow creating a rich dual-tone atmosphere",
    lightDirection: "Natural light from the LEFT through tall sash windows, warm fire and lamp glow from the RIGHT",
    shadowDirection: "Warm layered shadows with complex depth from the dual light sources, fire and lamp glow creating soft golden pools on the rug",
    propsPositioned: "A Persian rug beneath the furniture. Leather-bound books arranged on a side table. Fresh roses in a ceramic vase on a nearby surface. Deep green velvet curtains framing the sash windows on the left",
    materialBehavior: "The dark oak parquet shows subtle reflections from the window light while the Persian rug absorbs light with rich colour saturation and the cream walls diffuse warm tones",
    lightingSetup: "Late afternoon window daylight from the left as key, warm ambient lamp glow from the right as secondary, bounce from cream walls creating layered warmth",
    styleReference: "the warm traditional aesthetic of Simon Brown shooting for World of Interiors",
    lensSpec: "Shot with a 50mm vintage lens. Subtle vignette darkening the corners. Micro-variations in the aged wall paint visible at full resolution",
    atmosphere: "rich, warm, and inviting British country house in late afternoon",
  },
  luxury_penthouse: {
    mood: "glamorous, aspirational, and cinematic",
    contextAnchor: "a still from a Tom Ford film or an Architectural Digest penthouse feature",
    roomDescription: "a luxury penthouse apartment with floor-to-ceiling panoramic windows revealing a blurred city skyline at dusk, creating dramatic contrast between warm interior golden light and cool blue hour exterior",
    wallDescription: "Minimal white walls with floor-to-ceiling glass creating an expansive open feel against the blurred city skyline at dusk",
    flooring: "polished Calacatta marble with gold veining",
    flooringDirection: "with veining running diagonally across the floor, catching and reflecting the dramatic golden light",
    lightSource: "Golden hour sunlight streaming through panoramic floor-to-ceiling windows mixing with cool blue hour light from outside",
    lightQuality: "dramatic golden hour mixing with cool blue hour from outside creating cinematic contrast",
    lightDirection: "positioned on the LEFT through the panoramic windows",
    shadowDirection: "Long dramatic golden shadows stretch to the RIGHT across the marble floor, with warm light creating specular highlights on the polished marble surface",
    propsPositioned: "A sculptural designer floor lamp positioned in the background, unlit. Large-format coffee table books stacked on a nearby surface. A single statement art piece on the far wall",
    materialBehavior: "The polished marble floor creates clear reflections of the furniture and golden light, with gold veining catching specular highlights at certain angles",
    lightingSetup: "Dramatic golden-hour key light from the left panoramic windows, marble floor acting as a natural reflector providing fill from below, cool blue hour rim light from sky glow separating furniture from the cityscape",
    styleReference: "the dramatic cinematic quality of Roger Deakins cinematography in an interior setting",
    lensSpec: "Shot with a 24mm wide-angle lens. Subtle lens flare from the brightest window point. Chromatic aberration at high-contrast edges where golden interior meets blue exterior",
    atmosphere: "glamorous cinematic dusk with golden interior against blue city skyline",
  },
  minimalist_white: {
    mood: "pure, stark, and architecturally precise",
    contextAnchor: "an installation shot from a John Pawson space",
    roomDescription: "a pure minimalist interior with matte white walls, no skirting board visible, and a single window with white blinds on the LEFT providing stark directional light that creates crisp defined shadows",
    wallDescription: "Pure matte white walls with no skirting board, creating a seamless gallery-like volume where architecture dissolves into pure light and shadow",
    flooring: "polished light grey micro-cement",
    flooringDirection: "with a seamless jointless surface showing subtle texture variation under the directional light",
    lightSource: "A single window with white blinds on the LEFT",
    lightQuality: "stark directional light creating crisp defined shadows and bold graphic contrast",
    lightDirection: "positioned on the LEFT side of the room",
    shadowDirection: "Clean defined shadows fall sharply to the RIGHT, creating bold graphic contrast on the polished micro-cement floor",
    propsPositioned: "Almost nothing. A single architectural plant, one stem in a concrete vessel, placed at a deliberate distance to provide scale. The furniture is the sole focal point in an otherwise empty space",
    materialBehavior: "The polished micro-cement floor catches a subtle reflection of the furniture base, grounding it with realistic weight while the matte walls absorb light cleanly",
    lightingSetup: "Single directional key light from the left window creating bold shadow contrast, minimal fill allowing deep shadow areas, no artificial lighting, architecture as light modifier",
    styleReference: "the precise architectural photography of Hélène Binet",
    lensSpec: "Shot with a tilt-shift lens for perfect corner-to-corner sharpness. Subtle floor texture visible at full resolution. No depth of field falloff",
    atmosphere: "stark, pure, and contemplative architectural minimalism",
  },

  // ═══════════ BEDROOM ═══════════
  serene_bedroom: {
    mood: "peaceful, soft, and sanctuary-like",
    contextAnchor: "a boutique hotel room from Condé Nast Traveller",
    roomDescription: "a serene bedroom sanctuary with soft warm white walls and pale grey wool carpet, gentle morning light filtering through sheer white linen curtains on the RIGHT creating long gentle shadows across the space",
    wallDescription: "Soft warm white walls that glow gently in the morning light, creating a sense of calm sanctuary",
    flooring: "pale grey wool carpet",
    flooringDirection: "with a deep soft pile that shows subtle directional texture and compression from the furniture's weight",
    lightSource: "Sheer white linen curtains diffusing gentle morning sunlight on the RIGHT",
    lightQuality: "soft dreamy morning light with gentle backlight translucency visible through the curtains",
    lightDirection: "positioned on the RIGHT side of the room",
    shadowDirection: "Very soft diffused shadows fall gently to the LEFT with minimal contrast, long and gentle across the space creating an ethereal quality",
    propsPositioned: "A bedside table with a ceramic lamp with warm linen shade placed on the left. A small vase with dried eucalyptus stems nearby. A cashmere throw folded with understated elegance on a surface",
    materialBehavior: "The pale grey carpet compresses subtly under the furniture weight, showing realistic contact points, while the sheer curtains create gentle backlight translucency",
    lightingSetup: "Extremely soft diffused morning light as gentle key from the right, warm ambient fill bouncing from cream-toned walls and textiles, gentle backlight translucency on the sheer curtains",
    styleReference: "the dreamy aspirational photography of The White Company catalogue",
    lensSpec: "Shot with a 50mm lens at f/2.8. Extremely subtle depth of field. Gentle backlight translucency on the curtain fabric",
    atmosphere: "peaceful dreamy morning sanctuary",
  },
  boutique_hotel: {
    mood: "moody, luxurious, and intimate",
    contextAnchor: "a suite photograph from Soho House",
    roomDescription: "a boutique hotel suite with deep forest green walls in Little Greene Obsidian Green, white oak floor, and a warm brass pendant light switched ON casting golden pools of light downward, creating moody drama with cooler daylight from an off-frame window",
    wallDescription: "Deep forest green walls in Little Greene Obsidian Green with a subtle matte finish that absorbs light and creates an intimate moody atmosphere",
    flooring: "white oak",
    flooringDirection: "with planks running from rear to front, catching warm pendant light at its edges and showing natural grain in the golden pools of light",
    lightSource: "A warm brass pendant light switched ON combined with cooler daylight from an off-frame window",
    lightQuality: "warm pendant glow creating golden pools mixed with cooler daylight creating moody dramatic contrast",
    lightDirection: "Pendant positioned directly ABOVE casting downward pools of warm light, cooler daylight from an off-frame window",
    shadowDirection: "Dramatic pools of warm golden light on surfaces directly below the pendant, with deep atmospheric shadows in the room's corners and edges",
    propsPositioned: "Layered bedding with velvet cushions in deep jewel tones of emerald and sapphire. A chunky knit throw draped with studied casualness. A brass side table nearby with a small stack of books",
    materialBehavior: "The dark green walls absorb most light creating rich depth while the brass pendant produces warm specular highlights and the white oak catches golden pools of light between shadow areas",
    lightingSetup: "Warm brass pendant as overhead key light creating warm flare, cooler off-frame window as secondary fill, deep shadow contrast in corners creating intimate Soho House atmosphere",
    styleReference: "the moody intimate aesthetic of François Halard interior photography",
    lensSpec: "Shot with a 35mm lens at f/3.5. Warm flare from the brass pendant. Gentle noise visible in the deep shadow areas",
    atmosphere: "moody intimate boutique hotel evening with dramatic warm and cool contrast",
  },
  light_airy: {
    mood: "fresh, coastal, and relaxed",
    contextAnchor: "a renovated Cornish cottage from Livingetc",
    roomDescription: "a light and airy bedroom with white-painted shiplap walls showing visible board texture, bleached oak floor with visible knots, and abundant flooding natural light creating an almost high-key atmosphere with minimal shadows",
    wallDescription: "White-painted shiplap walls with visible horizontal board texture and subtle paint imperfections that add authentic coastal character",
    flooring: "bleached oak",
    flooringDirection: "with wide planks running left to right showing visible knots and natural grain variation in the bright flooding light",
    lightSource: "Multiple windows allowing abundant flooding natural light",
    lightQuality: "abundant flooding light creating an almost high-key atmosphere with minimal shadows",
    lightDirection: "positioned on both the LEFT and RIGHT sides of the room creating even omnidirectional illumination",
    shadowDirection: "Minimal shadows with high-key brightness throughout, creating an open breezy atmosphere where light fills every surface",
    propsPositioned: "Natural oatmeal linen textiles draped softly on surfaces. A woven rattan accent basket placed on the floor. Trailing green plants cascading from a shelf in the background. Natural imperfections in the shiplap boards visible",
    materialBehavior: "The bleached oak floors reflect bright light with a natural matte warmth while the shiplap texture catches light at different angles revealing board edges and the rattan shows woven detail",
    lightingSetup: "Abundant natural daylight from multiple windows as omnidirectional key creating high-key illumination, subtle warm bounce from bleached oak floors, almost no shadow fill needed",
    styleReference: "the bright relaxed aesthetic of Australian photographer Sharyn Cairns",
    lensSpec: "Shot with a 35mm lens at f/4. Gentle bloom in the brightest highlight areas. Natural imperfections in the shiplap boards visible at full resolution",
    atmosphere: "bright fresh coastal morning with sun-washed openness and natural textures",
  },

  // ═══════════ DINING ═══════════
  modern_dining: {
    mood: "sociable, warm, and contemporary",
    contextAnchor: "a feature image from Homes and Gardens",
    roomDescription: "a modern dining space with light warm walls, dark stained oak floor, and glass doors showing a blurred garden view bringing natural greenery into the scene. A statement three-globe brass pendant light hangs above the table area, switched ON and casting defined pools of warm light downward",
    wallDescription: "Light warm walls with a clean contemporary finish",
    flooring: "dark stained oak",
    flooringDirection: "with long planks running from front to back, creating visual depth in the composition",
    lightSource: "A statement three-globe brass pendant light switched ON hanging directly above, combined with natural fill light from glass garden doors to the side",
    lightQuality: "warm brass pendant glow combined with cool natural light from the garden doors creating dimensional two-tone lighting",
    lightDirection: "Pendant light directly ABOVE casting defined pools downward, natural light from the LEFT through glass garden doors",
    shadowDirection: "Defined downward shadows from the pendant light directly below objects, with softer side-fill from the garden doors creating subtle depth and specular highlights on glassware and brass",
    propsPositioned: "White tableware arranged for dinner on the table surface. Clear glassware catching specular highlights from the pendant. A low seasonal foliage arrangement in a ceramic vase at the table centre. Simple dining chairs positioned naturally around",
    materialBehavior: "The dark stained oak floor shows rich grain detail under the pendant's downward pools while the clear glassware creates bright specular highlights and the brass pendant catches its own reflection on glossy surfaces",
    lightingSetup: "Three-globe brass pendant overhead as primary key creating defined warm pools, natural garden-door light from the left as cooler fill, specular highlights on glassware and brass adding sparkle",
    styleReference: "the warm contemporary showroom photography of Tom Dixon",
    lensSpec: "Shot with a 24mm lens at f/5.6. Specular highlights visible on glassware and brass surfaces. Suggestion of gentle breeze movement in the foliage",
    atmosphere: "warm sociable contemporary dining in early evening with pendant glow",
  },
  rustic_farmhouse: {
    mood: "honest, warm, and full of Cotswolds countryside charm",
    contextAnchor: "a Cotswolds farmhouse from Country Living",
    roomDescription: "a rustic farmhouse dining room with exposed oak ceiling beams showing natural age and character, whitewashed textured walls, and wide-plank reclaimed pine floor with authentic patina. Warm late afternoon light streams through small-paned cottage windows creating gridded shadow patterns across surfaces",
    wallDescription: "Whitewashed textured walls with rough plaster imperfections and subtle warmth that conveys authentic centuries-old farmhouse character",
    flooring: "wide-plank reclaimed pine",
    flooringDirection: "with broad planks showing authentic knots, wear patterns, and warm patina running from left to right",
    lightSource: "Small-paned cottage windows on the RIGHT plus aged brass pendant lights hanging above",
    lightQuality: "warm late afternoon light through small cottage panes creating gridded shadow patterns mixing with amber pendant glow",
    lightDirection: "Natural light from the RIGHT through small-paned cottage windows casting gridded shadows, pendant light from ABOVE",
    shadowDirection: "Warm textured shadows with ceiling beam patterns and window-pane grid shadows casting across surfaces, creating an authentic interplay of natural and pendant light with golden warmth",
    propsPositioned: "Aged brass pendant lights hanging above. Linen napkins placed casually on the table. Handmade ceramic dishes stacked on the surface. A wooden bread board with an artisan loaf. Mismatched vintage wine glasses catching light. A ceramic pitcher with freshly gathered wildflowers at the centre",
    materialBehavior: "The reclaimed pine floor absorbs light warmly showing rich patina and age marks while the whitewashed walls diffuse warm tones and the brass pendants create amber specular highlights on nearby surfaces",
    lightingSetup: "Late afternoon cottage window light from the right creating gridded shadows as key, warm aged brass pendant as overhead fill, pine floor bouncing golden warmth into shadow areas",
    styleReference: "the authentic warm aesthetic of DeVOL Kitchens and Sebastian Cox design photography",
    lensSpec: "Shot with a 35mm vintage lens. Gentle vignette darkening the corners. Warmth in the shadow areas from pine floor bounce visible",
    atmosphere: "honest warm Cotswolds farmhouse in golden late afternoon",
  },

  // ═══════════ OFFICE ═══════════
  modern_office: {
    mood: "productive, clean, and inspiring",
    contextAnchor: "a workspace photograph from Kinfolk magazine",
    roomDescription: "a modern home office with clean white walls, a light ash floor, and a large window on the LEFT providing abundant natural task lighting that illuminates the desk area with bright focused daylight",
    wallDescription: "Clean white walls with a crisp finish that maximises natural light reflection throughout the productive workspace",
    flooring: "light ash",
    flooringDirection: "with pale planks running left to right, creating a calm neutral base beneath the workspace",
    lightSource: "A large window on the LEFT side",
    lightQuality: "abundant natural task lighting ideal for a productive workspace",
    lightDirection: "positioned on the LEFT side, illuminating the desk area directly",
    shadowDirection: "Clean gentle shadows fall to the RIGHT from the task lighting, creating subtle dimensional definition without drama",
    propsPositioned: "Open shelving on the back wall with styled books and small plants. A desk lamp turned off but present. A ceramic cup and stationery in a leather organiser on the desk. A woven rug beneath",
    materialBehavior: "The light ash floor reflects the bright task lighting neutrally while the shelving objects catch small highlights and the rug provides warmth contrast against the cool ash tones",
    lightingSetup: "Abundant natural task light from the left window as bright key, white wall bounce as even fill, gentle subtle shadows giving just enough depth",
    styleReference: "the bright productive aesthetic of Muji workspace and Kinfolk magazine",
    lensSpec: "Shot with a 35mm lens at f/4. Clean balanced exposure. Subtle depth of field placing focus on the primary furniture",
    atmosphere: "bright productive and inspiring modern workspace",
  },
  creative_studio: {
    mood: "edgy, industrial, and design-forward",
    contextAnchor: "a converted warehouse studio from Dezeen",
    roomDescription: "a converted warehouse creative studio with exposed brick wall on the LEFT showing original mortar texture, polished concrete floor with industrial character, and large steel-framed factory windows on the RIGHT flooding the space with directional north light",
    wallDescription: "Exposed brick wall on the LEFT with original mortar lines, paint remnants, and authentic warehouse patina that adds industrial authenticity and tactile warmth",
    flooring: "polished concrete",
    flooringDirection: "with a smooth industrial surface showing subtle aggregate texture, micro-cracks, and catch reflections under the factory window light",
    lightSource: "Large steel-framed factory windows on the RIGHT",
    lightQuality: "directional north light with industrial clarity creating defined shadows and honest material rendition",
    lightDirection: "positioned on the RIGHT side through steel-framed factory windows",
    shadowDirection: "Defined industrial shadows from steel window frames cross the polished concrete floor to the LEFT, with brick wall texture creating complex micro-shadows",
    propsPositioned: "A vintage Anglepoise desk lamp on a surface. Architecture and design books stacked on the floor leaning against the brick wall. A concrete planter with an architectural cactus. A framed blueprint or technical drawing propped against the wall",
    materialBehavior: "The polished concrete floor shows subtle reflections of the steel window frames while the exposed brick creates rich textured shadows and the overall palette stays muted and industrial",
    lightingSetup: "Strong directional north light from the right factory windows as key, ambient bounce from the polished concrete floor and brick wall providing warm fill, industrial clarity without artificial softness",
    styleReference: "the raw industrial aesthetic of Cereal magazine studio features",
    lensSpec: "Shot with a 28mm lens at f/5.6. Slight barrel distortion at edges. Concrete floor micro-texture visible at full resolution",
    atmosphere: "edgy design-forward converted warehouse with industrial north light",
  },

  // ═══════════ STUDIO ═══════════
  white_background: {
    mood: "pure e-commerce, clinical perfection",
    contextAnchor: "a product page on made.com or wayfair.co.uk",
    roomDescription: "a professional white cyclorama studio with infinite white background curving from floor to wall. Three-point professional studio lighting creating clean defined shadows. No room features visible, only pure white background with the furniture as the sole element",
    wallDescription: "Pure infinite white cyclorama background with no visible seam between floor and wall, curving seamlessly creating a clean void",
    flooring: "white cyclorama floor",
    flooringDirection: "seamlessly curving into the white background wall with no visible join line or horizon",
    lightSource: "Professional three-point studio lighting setup",
    lightQuality: "clean professional studio lighting with controlled shadows and perfect colour accuracy",
    lightDirection: "Key light from the FRONT-LEFT at 45 degrees, fill light from the RIGHT, subtle rim light from BEHIND",
    shadowDirection: "Clean controlled shadow falling to the RIGHT from the three-point setup, with subtle gradation and defined edges that ground the product",
    propsPositioned: "Nothing. Pure white background with only the furniture product visible. The furniture is isolated as a sculptural object against the seamless white void",
    materialBehavior: "Under the controlled three-point lighting, every material texture is revealed with precise accuracy: fabric weave, wood grain, metal finish, all rendered with perfect colour fidelity against the neutral white",
    lightingSetup: "Professional three-point studio setup: key light from front-left at 45 degrees, fill light from right at 60% intensity for shadow control, rim backlight for clean edge separation from white background",
    styleReference: "the pure clinical product photography of DFS and MADE.com product pages",
    lensSpec: "Shot with an 85mm lens at f/8. Perfect sharpness corner to corner. Zero distortion. Clinical precision colour accuracy",
    atmosphere: "pure clinical studio perfection for e-commerce",
  },
  grey_studio: {
    mood: "refined, gallery-like, and sculptural",
    contextAnchor: "a high-end furniture lookbook by B&B Italia",
    roomDescription: "a professional studio with mid-grey seamless paper backdrop creating a refined gallery-like atmosphere. Three-point lighting setup with controlled shadows treating the furniture as a sculptural exhibit. No room features, just grey void and considered lighting",
    wallDescription: "Mid-grey seamless paper backdrop creating a refined gallery-like atmosphere with subtle tonal graduation from centre to edges",
    flooring: "grey seamless paper continuing from backdrop",
    flooringDirection: "with paper curving from backdrop to floor seamlessly, showing subtle tonal variation",
    lightSource: "Three-point professional studio lighting",
    lightQuality: "refined sculpted studio light treating the furniture as a gallery exhibit with controlled dimensional shadows",
    lightDirection: "Key light from the FRONT-LEFT at 45 degrees, soft fill from the RIGHT, rim light from BEHIND",
    shadowDirection: "Defined key shadow falls to the RIGHT with softened edges from the fill light, a crisp rim highlight behind separates the furniture clearly from the grey background",
    propsPositioned: "A completely empty studio environment with only the furniture product visible as sculpture against the grey backdrop",
    materialBehavior: "The three-point lighting reveals every material texture with dimensional highlights on curved surfaces and controlled shadow depth in recesses, with perfect colour accuracy under neutral grey light",
    lightingSetup: "Classic three-point studio setup with key light front-left at 45 degrees creating form, fill light from right softening shadows to controlled density, rim backlight providing clean separation from background",
    styleReference: "the precise sculptural product photography of Poltrona Frau catalogues",
    lensSpec: "Shot with an 85mm lens at f/5.6. Perfect colour accuracy. Subtle paper texture visible at full resolution",
    atmosphere: "professional refined studio treating furniture as sculpture",
  },
  showroom_floor: {
    mood: "contextual, premium, and trade-show aspirational",
    contextAnchor: "Salone del Mobile furniture fair photography",
    roomDescription: "a polished concrete showroom floor with professional track lighting above creating focused highlights on the hero furniture piece, white walls receding to grey in the background, with other furniture pieces visible but deliberately blurred suggesting a curated collection at an international furniture fair",
    wallDescription: "White showroom walls receding to grey in the distance, with blurred furniture forms suggesting a curated international collection",
    flooring: "polished concrete showroom floor",
    flooringDirection: "with a smooth reflective surface showing the furniture and overhead track lighting as soft reflections beneath",
    lightSource: "Professional ceiling-mounted track spot lights",
    lightQuality: "focused directional track spots creating defined highlights on the hero piece with ambient showroom fill in the background",
    lightDirection: "positioned ABOVE on ceiling-mounted track spots directed at the hero furniture",
    shadowDirection: "Defined downward shadows directly beneath the furniture from the overhead track spots, with gentle reflections of the furniture visible in the polished concrete floor",
    propsPositioned: "Other furniture pieces visible but deliberately BLURRED in the background at varying distances, suggesting a thoughtfully curated showroom collection at an international furniture fair. The hero piece is isolated by shallow depth of field",
    materialBehavior: "The polished concrete floor creates soft reflections of the furniture base grounding it with visual weight and the track lights produce defined specular highlights on any glossy or metallic elements, while background furniture dissolves into soft shapes",
    lightingSetup: "Professional overhead track spots as focused key on the hero piece, ambient showroom bounce as fill, background naturally darker and blurred drawing all focus to the hero furniture",
    styleReference: "the premium trade-fair photography of Minotti and Flexform marketing materials",
    lensSpec: "Shot with a 35mm lens at f/2.8. Shallow depth of field isolating the hero piece. Subtle floor reflections grounding the furniture with weight",
    atmosphere: "premium curated international showroom floor display",
  },
};

// ── Build a full C.S.S.T. prompt for IMAGE 1 (master generation) or single image ──
function buildTemplatePrompt(
  config: TemplateConfig,
  aspectRatio: string,
  resolution: string,
  cameraAngle: string | null,
  batchTotal: number = 1,
  label?: string,
  customPrompt?: string
): string {
  const shotType = getShotType(label);
  const isCloseUp = (label || "").toLowerCase().includes("close-up") || (label || "").toLowerCase().includes("fabric");

  // For close-ups on single images, use the shot-type specific prompt
  const angleInstruction = isCloseUp
    ? shotType.framing
    : cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]
      ? CAMERA_ANGLE_PROMPTS[cameraAngle]
      : "The camera is positioned at eye level, looking straight on at the furniture piece.";

  const imperfections = pickImperfections(2);

  const batchNote = batchTotal > 1
    ? `\n\nBATCH MASTER: This is image 1 of ${batchTotal}. This generated room will be used as the MASTER BACKGROUND for all subsequent images. Make the room environment detailed, complete, and consistent so it can be reused.\n\n`
    : "";

  // For close-ups in single mode, use the shot-type prompt builder
  if (isCloseUp && batchTotal <= 1) {
    const shotPrompt = shotType.buildPrompt(config);
    return `${PRODUCT_PRESERVATION}

${shotPrompt}

[STYLE]: Photorealistic commercial interior photography. ${config.lightingSetup}. Reference: ${config.styleReference}.

[TECHNICAL FLAVOR]: ${config.lensSpec}. ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: Generate at the MAXIMUM possible resolution. Ultra high resolution output. Every detail must be crisp and sharp at full zoom.`;
  }

  return `${batchNote}[CONTEXT]: This is a premium furniture e-commerce photograph for a UK retailer website. The tone is ${config.mood}. Think of it as ${config.contextAnchor}.

[SUBJECT & LOGIC]: Place this exact furniture piece naturally in ${config.roomDescription}. The furniture sits on ${config.flooring} ${config.flooringDirection}. ${config.wallDescription}. ${config.lightSource} ${config.lightDirection} casts ${config.lightQuality} across the scene. ${config.shadowDirection}. Include ${config.propsPositioned}. The furniture appears grounded with realistic contact shadows where the base meets the floor, showing subtle compression and contact points. ${config.materialBehavior}. Scale is accurate for a real interior space. ${angleInstruction}

[STYLE]: Photorealistic commercial interior photography. ${config.lightingSetup}. The furniture materials interact with light realistically: ${config.materialBehavior}. Reference: ${config.styleReference}.

[TECHNICAL FLAVOR]: ${config.lensSpec}. ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: Generate at the MAXIMUM possible resolution. Ultra high resolution output. Every detail must be crisp and sharp at full zoom.${customPrompt ? `\n\nADDITIONAL SHOT DIRECTION: ${customPrompt}` : ""}`;
}

// ── Build a C.S.S.T. prompt from a custom user description (image 1 only) ──
function buildCustomPrompt(
  userInput: string,
  aspectRatio: string,
  resolution: string,
  cameraAngle: string | null,
  batchTotal: number = 1
): string {
  const angleInstruction = cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]
    ? CAMERA_ANGLE_PROMPTS[cameraAngle]
    : "";

  const imperfections = pickImperfections(2);

  const batchNote = batchTotal > 1
    ? `\n\nBATCH MASTER: This is image 1 of ${batchTotal}. This generated room will be used as the MASTER BACKGROUND for all subsequent images. Make the room environment detailed, complete, and consistent so it can be reused.\n\n`
    : "";

  return `${batchNote}[CONTEXT]: This is a premium furniture e-commerce photograph for a UK retailer website. The tone is aspirational and lifestyle-focused. Think of it as a hero image from a premium furniture retailer catalogue.

[SUBJECT & LOGIC]: Place this exact furniture piece naturally in ${userInput}. The furniture appears grounded with realistic contact shadows where the base meets the floor. Shadows fall correctly based on visible light sources in the scene. Scale is accurate for a real interior space. ${angleInstruction}

[STYLE]: Photorealistic commercial interior photography. Natural lighting that accurately represents furniture materials with realistic surface interactions. Reference: high-end British furniture retail photography.

[TECHNICAL FLAVOR]: Shot with a 35mm lens at f/4. ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: Generate at the MAXIMUM possible resolution. Ultra high resolution output. Every detail must be crisp and sharp at full zoom.`;
}

// ── Build editing prompt for images 2+ using shot-type matching (ROOM SHOTS ONLY) ──
function buildEditingPrompt(
  label: string | undefined,
  batchIndex: number,
  batchTotal: number,
  aspectRatio: string,
  resolution: string,
  templateConfig: TemplateConfig | null,
  customPrompt?: string
): string {
  const shotType = getShotType(label);
  const shotPrompt = shotType.buildPrompt(templateConfig);
  const imperfections = pickImperfections(2);

  return `EDITING TASK: You have two reference images.

IMAGE 1 (MASTER BACKGROUND): This is the room environment to PRESERVE EXACTLY. Keep the identical:
- Room layout, walls, floor - every architectural element stays unchanged
- Lighting direction and quality - same light sources, same colour temperature
- All props in their exact same positions - nothing moves, nothing added, nothing removed
- Color temperature and atmosphere - the mood is identical
- Every detail of this room stays pixel-perfect unchanged

IMAGE 2 (PRODUCT REFERENCE): This is the furniture product to place INTO the room.
- Use this as the EXACT product reference
- Match this product's shape, materials, colors, textures, and design details precisely
- The reference image shows a ${label || "full product"} view of the product

SHOT TYPE MATCHING:
${shotType.framing}

TASK: ${shotPrompt}
- Keep the ENTIRE room from Image 1 unchanged - walls, floor, lighting, props, atmosphere
- Only swap the furniture piece
- Shadows and reflections update to match the new furniture position and the existing light sources
- Contact shadows where the furniture meets the floor must match the room's lighting direction
- The output framing must match the SHOT DIRECTION instructions above, not the reference image framing. The reference image is provided for PRODUCT IDENTITY only — use it to match the exact product appearance, not the camera angle.
- Everything else stays IDENTICAL to Image 1

This is image ${batchIndex + 1} of ${batchTotal} in a product photography set. All images must look like they were shot in the exact same room during the same photoshoot session.

${PRODUCT_PRESERVATION}

[TECHNICAL FLAVOR]: ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: Generate at the MAXIMUM possible resolution. Ultra high resolution output.${customPrompt ? `\n\nADDITIONAL SHOT DIRECTION: ${customPrompt}` : ""}`;
}

// ── Build close-up prompt (independent generation, no master background) ──
function buildCloseUpPrompt(
  label: string | undefined,
  numReferenceImages: number,
  aspectRatio: string,
  resolution: string,
  customPrompt?: string
): string {
  const shotType = getShotType(label);
  const imperfections = pickImperfections(2);

  return `PRODUCT CLOSE-UP PHOTOGRAPHY

You have ${numReferenceImages} reference image${numReferenceImages > 1 ? "s" : ""} of the SAME furniture product from different angles. Study ALL of them to understand every detail of this product.

TASK: ${shotType.framing}

${customPrompt ? `SPECIFIC SHOT DIRECTION: ${customPrompt}` : ""}

BACKGROUND: Soft, blurred, neutral background. Use a shallow depth of field (f/2.8) so only the detail area is in sharp focus. The background should suggest a warm room environment (warm tones, natural light) but be completely out of focus. Do NOT show the full room or full furniture piece — this is a DETAIL shot filling the frame.

The product detail must EXACTLY match the reference images — same material, colour, texture, stitching pattern, leg shape, hardware finish.

${PRODUCT_PRESERVATION}

[TECHNICAL FLAVOR]: Macro lens at f/2.8 equivalent. ${imperfections[0]}. ${imperfections[1]}.

[ASPECT RATIO]: ${aspectRatio || "1:1"}.
[RESOLUTION]: Generate at the MAXIMUM possible resolution. Ultra high resolution output.`;
}


// V2: All generations are 4K, 1 credit each
const GENERATION_CREDIT_COST = 1;

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
      image_id,
      template_id,
      resolution,
      custom_prompt,
      aspect_ratio,
      camera_angle,
      set_id,
      label,
      batch_index,
      batch_total,
      master_background_path,
      reference_image_ids,
      additional_image_ids,
      product_analysis,
      generation_strategy, // "closeup" for close-up shots that skip master BG
    } = await req.json();

    // Input validation
    if (!image_id) throw new Error("Missing image_id");
    const validResolutions = ["1k", "2k", "4k"];
    if (resolution && !validResolutions.includes(resolution)) {
      throw new Error("Invalid resolution. Must be '1k', '2k', or '4k'");
    }
    const validAspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    if (aspect_ratio && !validAspectRatios.includes(aspect_ratio)) {
      throw new Error("Invalid aspect_ratio");
    }
    const validAngles = ["eye_level", "standard", "elevated", "low_angle", "side_profile", "corner_view", "front", "rear_angle", "top_down", "macro"];
    if (camera_angle && !validAngles.includes(camera_angle)) {
      throw new Error("Invalid camera_angle");
    }

    const isCloseUpStrategy = generation_strategy === "closeup";
    const isBatch = typeof batch_index === "number" && typeof batch_total === "number" && batch_total > 1;
    const isFirstInBatch = isBatch && batch_index === 0;
    // Close-up shots are NOT treated as "subsequent in batch" even if batch_index > 0
    const isSubsequentInBatch = isBatch && batch_index > 0 && !isCloseUpStrategy;

    const templateConfig = TEMPLATES[template_id];

    // ── Build prompt ──
    let prompt: string;

    if (isCloseUpStrategy) {
      // Close-up shots: independent generation, no master background
      const numRefImages = 1 + (additional_image_ids?.length || 0);
      prompt = buildCloseUpPrompt(label, numRefImages, aspect_ratio, resolution, custom_prompt);
    } else if (isSubsequentInBatch && master_background_path) {
      // Images 2+: editing prompt with shot-type matching
      prompt = buildEditingPrompt(label, batch_index, batch_total, aspect_ratio, resolution, templateConfig || null, custom_prompt);
    } else if (template_id === "custom" && custom_prompt) {
      prompt = buildCustomPrompt(custom_prompt, aspect_ratio, resolution, camera_angle, isBatch ? batch_total : 1);
    } else if (templateConfig) {
      prompt = buildTemplatePrompt(templateConfig, aspect_ratio, resolution, camera_angle, isBatch ? batch_total : 1, label, custom_prompt);
    } else {
      throw new Error("Invalid template");
    }

    const creditsNeeded = GENERATION_CREDIT_COST;

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

    // Get product image record
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

    // Download product image from storage
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .download(imageRecord.original_url);

    if (dlErr || !fileData) {
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      throw new Error("Failed to download image");
    }

    const imageBytes = new Uint8Array(await fileData.arrayBuffer());
    const base64Product = base64Encode(imageBytes);
    const productMimeType = imageRecord.filename?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    // ── Download additional reference images if provided ──
    const allRefIds = new Set<string>();
    if (reference_image_ids && Array.isArray(reference_image_ids)) {
      reference_image_ids.forEach((id: string) => allRefIds.add(id));
    }
    if (additional_image_ids && Array.isArray(additional_image_ids)) {
      additional_image_ids.forEach((id: string) => allRefIds.add(id));
    }
    allRefIds.delete(image_id);

    const additionalRefParts: Array<Record<string, unknown>> = [];
    if (allRefIds.size > 0) {
      console.log(`Downloading ${allRefIds.size} additional reference images`);
      for (const refId of allRefIds) {
        try {
          const { data: refRecord } = await supabaseAdmin
            .from("images")
            .select("*")
            .eq("id", refId)
            .eq("user_id", user.id)
            .single();
          if (!refRecord?.original_url) continue;
          const { data: refFileData } = await supabaseAdmin.storage
            .from("furniture-images")
            .download(refRecord.original_url);
          if (!refFileData) continue;
          const refBytes = new Uint8Array(await refFileData.arrayBuffer());
          const refBase64 = base64Encode(refBytes);
          const refMime = refRecord.filename?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
          additionalRefParts.push({ inlineData: { mimeType: refMime, data: refBase64 } });
        } catch (e) {
          console.warn(`Failed to download reference image ${refId}:`, e);
        }
      }
      console.log(`Successfully loaded ${additionalRefParts.length} additional reference images`);
    }

    // ── Download master background for room shots 2+ (NOT close-ups) ──
    let base64Master: string | null = null;
    let masterMimeType = "image/png";
    if (isSubsequentInBatch && master_background_path) {
      console.log("Downloading master background:", master_background_path);
      const { data: masterData, error: masterErr } = await supabaseAdmin.storage
        .from("furniture-images")
        .download(master_background_path);

      if (masterErr || !masterData) {
        await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
        throw new Error("Failed to download master background image");
      }

      const masterBytes = new Uint8Array(await masterData.arrayBuffer());
      base64Master = base64Encode(masterBytes);
      masterMimeType = master_background_path.endsWith(".png") ? "image/png" : "image/jpeg";
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const generationStartMs = Date.now();

    console.log(
      "Calling DIRECT Gemini API |",
      isCloseUpStrategy ? `CLOSE-UP (independent)` :
      isSubsequentInBatch ? `EDIT into master (${batch_index + 1}/${batch_total})` :
      isFirstInBatch ? `MASTER generation (1/${batch_total})` : "single",
      "| template:", template_id,
      "| prompt length:", prompt.length
    );

    // ── Build product analysis prefix if provided ──
    const analysisPrefix = product_analysis
      ? `PRODUCT REFERENCE DESCRIPTION (from analysing all uploaded photos): ${product_analysis}\nThe output MUST match this exact product.\n\n`
      : "";

    // ── Build Gemini API parts ──
    let parts: Array<Record<string, unknown>>;
    let debugPromptPath: string;

    if (isCloseUpStrategy) {
      debugPromptPath = "buildCloseUpPrompt";
      // ═══ CLOSE-UP: Product images only, no master background ═══
      const refIntro = additionalRefParts.length > 0
        ? `${analysisPrefix}${PRODUCT_PRESERVATION}\n\nCRITICAL: The following ${1 + additionalRefParts.length} images show the SAME furniture product from different angles. Study ALL of them to accurately reproduce every detail of this EXACT product in the close-up.`
        : `${analysisPrefix}${PRODUCT_PRESERVATION}\n\nStudy this reference image carefully to reproduce every detail of this EXACT product in the close-up.`;
      parts = [
        { text: refIntro },
        { inlineData: { mimeType: productMimeType, data: base64Product } },
        ...additionalRefParts,
        { text: prompt },
      ];
    } else if (isSubsequentInBatch && base64Master) {
      debugPromptPath = "buildEditingPrompt";
      // ═══ IMAGES 2+: Master background + product + all reference images + editing prompt ═══
      parts = [
        { text: `${analysisPrefix}EDITING TASK: Image 1 is the MASTER BACKGROUND room to preserve exactly. Image 2 is the PRODUCT to place into it. Additional images show the SAME product from other angles — use them to understand every detail. Keep the room pixel-perfect identical. Only replace the furniture.` },
        { inlineData: { mimeType: masterMimeType, data: base64Master } },
        { inlineData: { mimeType: productMimeType, data: base64Product } },
        ...additionalRefParts,
        { text: prompt },
      ];
    } else {
      debugPromptPath = template_id === "custom" ? "buildCustomPrompt" : "buildTemplatePrompt";
      // ═══ IMAGE 1 or SINGLE: Standard generation with all references ═══
      const refIntro = additionalRefParts.length > 0
        ? `${analysisPrefix}${PRODUCT_PRESERVATION}\n\nCRITICAL: The following ${1 + additionalRefParts.length} images show the SAME furniture product from different angles. Use ALL of them as reference to accurately reproduce this EXACT product. Only the background environment changes.`
        : `${analysisPrefix}${PRODUCT_PRESERVATION}\n\nCRITICAL: Preserve this EXACT furniture product unchanged. Only place it in a new environment.`;
      parts = [
        { text: refIntro },
        { inlineData: { mimeType: productMimeType, data: base64Product } },
        ...additionalRefParts,
        { text: prompt },
      ];
    }

    // ── Debug logging: log parts array summary ──
    const debugPartsLog = parts.map((p: any) => {
      if (p.text) return { type: "text", length: p.text.length, preview: p.text.substring(0, 80) + (p.text.length > 80 ? "..." : "") };
      if (p.inlineData) return { type: "inlineData", mimeType: p.inlineData.mimeType, size: `${Math.round(p.inlineData.data.length * 0.75 / 1024)}KB` };
      return { type: "unknown" };
    });
    const shotLabel = label || "single";
    const shotNum = typeof batch_index === "number" ? `${batch_index + 1}/${batch_total}` : "1/1";
    console.log(`[SHOT DEBUG] Shot ${shotNum} "${shotLabel}" [strategy: ${isCloseUpStrategy ? "closeup" : isSubsequentInBatch ? "editing" : "standard"}]\n  Parts:`, JSON.stringify(debugPartsLog, null, 2), `\n  Master BG: ${master_background_path || "none"}`);

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
            contents: [{ parts }],
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

      const modelNotAvailable = response.status === 404 && /not found|not supported/i.test(errText);
      if (modelNotAvailable) {
        console.warn(`Gemini model unavailable: ${geminiModel}. Trying fallback.`);
        continue;
      }

      break;
    }

    if (!aiResponse) {
      console.error("Gemini API error:", aiErrorStatus, aiErrorText);
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);

      if (aiErrorStatus === 429) {
        return new Response(
          JSON.stringify({ error: "AI service rate limited. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiErrorStatus === 402) {
        return new Response(
          JSON.stringify({ error: "AI service payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI generation failed: " + aiErrorText.substring(0, 200));
    }

    console.log("Gemini model used:", usedModel);
    const generationTimeMs = Date.now() - generationStartMs;

    const aiResult = await aiResponse.json();

    // Extract generated image from Gemini native response format
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
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      console.error("No image in Gemini response:", JSON.stringify(aiResult).substring(0, 1000));
      throw new Error("AI did not return an image. Please try again.");
    }

    // Always save as PNG for lossless quality
    const outputPath = `${user.id}/outputs/${job.id}.png`;

    const binaryString = atob(generatedBase64);
    const outputBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      outputBytes[i] = binaryString.charCodeAt(i);
    }

    console.log("Image generated |", Math.round(outputBytes.length / 1024), "KB |", generatedMimeType);

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("furniture-images")
      .upload(outputPath, outputBytes, { contentType: "image/png" });

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

    // For image 1 in batch, return the output storage path so client can pass it for subsequent images
    const masterPath = isFirstInBatch ? outputPath : undefined;

    // Store master background path in product_sets if applicable
    if (isFirstInBatch && set_id) {
      const roomLock = templateConfig ? extractRoomLock(template_id, templateConfig) : null;
      await supabaseAdmin
        .from("product_sets")
        .update({ room_lock: { ...roomLock, master_background_path: outputPath } as any })
        .eq("id", set_id);
    }

    console.log(
      "Generation complete. Job:", job.id,
      isCloseUpStrategy ? "(CLOSE-UP independent)" :
      isFirstInBatch ? `(MASTER - batch 1/${batch_total})` :
      isBatch ? `(EDIT - batch ${batch_index + 1}/${batch_total})` : ""
    );

    // ── Build debug object ──
    const textParts = parts.filter((p: any) => p.text);
    const imageParts = parts.filter((p: any) => p.inlineData);
    const finishReason = aiResult.candidates?.[0]?.finishReason || "UNKNOWN";
    const safetyRatings = aiResult.candidates?.[0]?.safetyRatings || [];
    const usageMetadata = aiResult.usageMetadata || {};

    const debugInfo = {
      final_prompt: prompt,
      model_used: usedModel,
      num_reference_images: 1 + additionalRefParts.length,
      product_analysis_included: !!product_analysis,
      product_analysis_length: product_analysis ? product_analysis.length : 0,
      product_analysis_preview: product_analysis ? product_analysis.substring(0, 200) : null,
      label: label || null,
      camera_angle: camera_angle || null,
      master_background_used: !!(isSubsequentInBatch && master_background_path),
      master_background_path: master_background_path || null,
      prompt_path: debugPromptPath,
      generation_strategy: isCloseUpStrategy ? "closeup" : isSubsequentInBatch ? "editing" : "standard",
      custom_prompt_included: !!custom_prompt,
      custom_prompt_value: custom_prompt || null,
      total_parts_count: parts.length,
      image_parts_count: imageParts.length,
      text_parts_count: textParts.length,
      generation_time_ms: generationTimeMs,
      gemini_finish_reason: finishReason,
      gemini_safety_ratings: safetyRatings,
      gemini_token_count: {
        prompt: usageMetadata.promptTokenCount || 0,
        output: usageMetadata.candidatesTokenCount || 0,
        total: usageMetadata.totalTokenCount || 0,
      },
      batch_index: batch_index ?? null,
      batch_total: batch_total ?? null,
    };

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        output_url: signedUrl?.signedUrl || null,
        output_path: outputPath,
        credits_remaining: profile.credits_remaining - creditsNeeded,
        master_background_path: masterPath || null,
        debug: debugInfo,
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
