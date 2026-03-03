import scandinavianImg from "@/assets/templates/scandinavian.jpg";
import bedroomImg from "@/assets/templates/bedroom.jpg";
import officeImg from "@/assets/templates/office.jpg";
import diningImg from "@/assets/templates/dining.jpg";
import industrialImg from "@/assets/templates/industrial.jpg";
import britishImg from "@/assets/templates/british.jpg";

// --- Types ---

export interface Template {
  id: string;
  name: string;
  description: string;
  image: string;
  popular?: boolean;
  virtualPrompt?: string;
}

export interface Category {
  label: string;
  templates: Template[];
}

export interface CameraAngle {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export interface CameraAngleGroup {
  label: string;
  angles: CameraAngle[];
}

export interface PlatformPreset {
  id: string;
  label: string;
  aspectRatio: string;
  tip: string;
}

export interface LightingMood {
  id: string;
  label: string;
  promptAppend: string;
}

export interface ChipCategory {
  label: string;
  chips: string[];
}

// --- Constants ---

export const FIXED_RESOLUTION = "4k";
export const CREDIT_COST = 1;
export const VARIATION_OPTIONS = [1, 2, 3, 4, 5];

// --- Aspect Ratios ---

export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "4:3", label: "4:3" },
  { id: "3:4", label: "3:4" },
];

// --- Categories with corrected image mappings ---

export const CATEGORIES: Category[] = [
  {
    label: "Living Room",
    templates: [
      { id: "scandinavian", name: "Modern Scandinavian", description: "Light oak floors, white walls, floor-to-ceiling windows", image: scandinavianImg, popular: true },
      { id: "contemporary_grey", name: "Contemporary Grey", description: "Warm grey walls, sheer curtains, textured rug", image: scandinavianImg },
      { id: "cozy_british", name: "Cozy British", description: "Fireplace, Persian rug, velvet curtains, fresh flowers", image: britishImg },
      { id: "luxury_penthouse", name: "Luxury Penthouse", description: "City skyline, marble floors, golden hour lighting", image: scandinavianImg },
      { id: "minimalist_white", name: "Minimalist White", description: "Pure white walls, concrete floor, stark light", image: scandinavianImg },
    ],
  },
  {
    label: "Bedroom",
    templates: [
      { id: "serene_bedroom", name: "Serene Bedroom", description: "Soft white walls, plush carpet, morning light", image: bedroomImg, popular: true },
      { id: "boutique_hotel", name: "Boutique Hotel", description: "Dark green walls, brass pendant, moody lighting", image: bedroomImg },
      { id: "light_airy", name: "Light & Airy", description: "White shiplap, bleached oak, rattan accents, plants", image: bedroomImg },
    ],
  },
  {
    label: "Dining",
    templates: [
      { id: "modern_dining", name: "Modern Dining", description: "Statement pendant, dark oak floor, garden view", image: diningImg },
      { id: "rustic_farmhouse", name: "Rustic Farmhouse", description: "Exposed beams, whitewashed walls, vintage pendants", image: diningImg },
    ],
  },
  {
    label: "Office",
    templates: [
      { id: "modern_office", name: "Modern Home Office", description: "Clean white walls, large window, built-in shelving", image: officeImg },
      { id: "creative_studio", name: "Creative Studio", description: "White brick, concrete floor, industrial windows", image: officeImg },
    ],
  },
  {
    label: "Studio / Product",
    templates: [
      { id: "white_background", name: "Pure White Background", description: "Even lighting, no shadows, 85% fill — for Amazon/eBay", image: officeImg, popular: true },
      { id: "grey_studio", name: "Grey Studio", description: "Seamless grey, three-point lighting, professional", image: industrialImg },
      { id: "showroom_floor", name: "Showroom Floor", description: "Polished concrete, track lighting, blurred background", image: industrialImg },
    ],
  },
  {
    label: "Outdoor / Garden",
    templates: [
      {
        id: "virtual_patio",
        name: "Patio Terrace",
        description: "Mediterranean terrace with terracotta tiles and olive trees",
        image: britishImg,
        virtualPrompt: "A Mediterranean terrace with terracotta tiles, olive trees, and warm evening light",
      },
      {
        id: "virtual_garden",
        name: "English Garden",
        description: "Manicured lawn, stone paving, dappled sunlight",
        image: britishImg,
        virtualPrompt: "An English country garden setting with manicured lawn, stone paving, and dappled afternoon sunlight through mature trees",
      },
      {
        id: "virtual_balcony",
        name: "City Balcony",
        description: "Glass balustrade, potted plants, urban skyline",
        image: scandinavianImg,
        virtualPrompt: "A modern city balcony with glass balustrade, potted plants, and urban skyline at golden hour",
      },
    ],
  },
  {
    label: "Hospitality / Commercial",
    templates: [
      {
        id: "virtual_hotel_lobby",
        name: "Hotel Lobby",
        description: "Marble floors, brass fixtures, dramatic pendant lighting",
        image: industrialImg,
        virtualPrompt: "A boutique hotel lobby with marble floors, brass fixtures, and dramatic pendant lighting",
      },
      {
        id: "virtual_restaurant",
        name: "Restaurant",
        description: "Warm ambient lighting, exposed brick, intimate settings",
        image: britishImg,
        virtualPrompt: "An upscale restaurant interior with warm ambient lighting, exposed brick, and intimate table settings",
      },
      {
        id: "virtual_cafe",
        name: "Cafe Interior",
        description: "Whitewashed walls, reclaimed wood, morning sunlight",
        image: diningImg,
        virtualPrompt: "A bright artisan cafe with whitewashed walls, reclaimed wood, and morning sunlight through large windows",
      },
      {
        id: "virtual_retail",
        name: "Retail Showroom",
        description: "Spot lighting, neutral grey walls, polished concrete",
        image: industrialImg,
        virtualPrompt: "A premium retail showroom with spot lighting, neutral grey walls, and polished concrete floors",
      },
    ],
  },
  {
    label: "Lifestyle / Themed",
    templates: [
      {
        id: "virtual_coastal",
        name: "Coastal Retreat",
        description: "White linen, pale blue accents, driftwood textures",
        image: bedroomImg,
        virtualPrompt: "A bright coastal living space with white linen, pale blue accents, driftwood textures, and ocean light",
      },
      {
        id: "virtual_mid_century",
        name: "Mid-Century Modern",
        description: "Walnut furniture, teak sideboard, warm amber tones",
        image: britishImg,
        virtualPrompt: "A 1960s-inspired room with walnut furniture, teak sideboard, statement rug, and warm amber tones",
      },
      {
        id: "virtual_japandi",
        name: "Japandi",
        description: "Tatami-inspired flooring, shoji screens, zen minimalism",
        image: scandinavianImg,
        virtualPrompt: "A serene Japanese-Scandinavian fusion space with tatami-inspired flooring, shoji screens, and zen minimalism",
      },
      {
        id: "virtual_art_deco",
        name: "Art Deco",
        description: "Geometric patterns, emerald and gold, dramatic lighting",
        image: industrialImg,
        virtualPrompt: "A glamorous Art Deco interior with geometric patterns, rich emerald and gold, and dramatic lighting",
      },
      {
        id: "virtual_nursery",
        name: "Nursery",
        description: "Soft pastel walls, natural wood accents, gentle daylight",
        image: bedroomImg,
        virtualPrompt: "A calm nursery with soft pastel walls, natural wood accents, and gentle diffused daylight",
      },
      {
        id: "virtual_bathroom",
        name: "Bathroom",
        description: "White marble surfaces, walk-in shower glass, bright lighting",
        image: scandinavianImg,
        virtualPrompt: "A modern bathroom with white marble surfaces, walk-in shower glass, and clean bright lighting",
      },
    ],
  },
];

export const ALL_TEMPLATES = CATEGORIES.flatMap((c) => c.templates);

// --- Camera Angles (grouped) ---

export const CAMERA_ANGLE_GROUPS: CameraAngleGroup[] = [
  {
    label: "Standard Views",
    angles: [
      { id: "eye_level", label: "Eye Level", description: "Direct front-on view at standing height", prompt: "" },
      { id: "elevated", label: "Elevated 3/4", description: "Slightly above, showing top and front", prompt: "Shot from a slightly elevated 3/4 angle, showing the top and front of the furniture." },
      { id: "low_angle", label: "Low Angle", description: "From floor level, looking up — grand and imposing", prompt: "Shot from a low angle looking upward, making the furniture appear grand and imposing." },
    ],
  },
  {
    label: "Detail Views",
    angles: [
      { id: "side_profile", label: "Side Profile", description: "Full 90-degree side silhouette", prompt: "Shot from a 90-degree side profile view." },
      { id: "corner_view", label: "Corner View", description: "45-degree angle showing two sides", prompt: "Shot from a 45-degree corner angle showing two sides of the furniture." },
    ],
  },
];

export const ALL_CAMERA_ANGLES = CAMERA_ANGLE_GROUPS.flatMap((g) => g.angles);

// --- Platform Presets ---

export const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "instagram_post", label: "Instagram Post", aspectRatio: "1:1", tip: "Square crop, clean and centred" },
  { id: "instagram_story", label: "Instagram Story", aspectRatio: "9:16", tip: "Vertical, dramatic full-height framing" },
  { id: "website_hero", label: "Website Hero", aspectRatio: "16:9", tip: "Wide landscape, room for text overlay" },
  { id: "product_listing", label: "Product Listing", aspectRatio: "4:3", tip: "Standard e-commerce product image" },
  { id: "pinterest", label: "Pinterest", aspectRatio: "3:4", tip: "Tall portrait, scroll-stopping format" },
  { id: "facebook_ad", label: "Facebook Ad", aspectRatio: "1:1", tip: "Square, bold and attention-grabbing" },
];

// --- Lighting Moods ---

export const LIGHTING_MOODS: LightingMood[] = [
  { id: "natural", label: "Natural Daylight", promptAppend: "" },
  { id: "golden_hour", label: "Golden Hour", promptAppend: ", warm golden hour sunlight casting long amber shadows" },
  { id: "moody", label: "Moody & Dramatic", promptAppend: ", dramatic moody lighting with deep shadows and warm pools of light" },
  { id: "bright", label: "Bright & Airy", promptAppend: ", bright high-key lighting with minimal shadows, fresh and open" },
  { id: "cosy", label: "Cosy Evening", promptAppend: ", warm evening lamplight with soft amber glow and intimate atmosphere" },
  { id: "studio", label: "Studio Flash", promptAppend: ", professional studio flash lighting, even and controlled, no ambient" },
];

// --- Custom Prompt Chips (10 categories, 80+ chips) ---

export const CUSTOM_PROMPT_CHIPS: ChipCategory[] = [
  {
    label: "Room Type",
    chips: ["Living room", "Bedroom", "Dining room", "Kitchen", "Bathroom", "Nursery", "Home office", "Hallway", "Conservatory", "Loft apartment"],
  },
  {
    label: "Architectural Style",
    chips: ["Modern", "Victorian", "Georgian", "Art Deco", "Industrial", "Cottage", "Farmhouse", "Mid-century", "Japandi", "Mediterranean"],
  },
  {
    label: "Wall Treatment",
    chips: ["White painted walls", "Exposed brick", "Wood panelling", "Wallpaper feature wall", "Concrete", "Stone", "Plaster texture", "Dark painted walls"],
  },
  {
    label: "Flooring",
    chips: ["Oak hardwood", "Dark walnut", "Marble", "Concrete", "Carpet", "Herringbone parquet", "Terracotta tile", "Limestone"],
  },
  {
    label: "Lighting",
    chips: ["Morning light", "Golden hour", "Bright daylight", "Cosy evening", "Candlelight glow", "Overcast diffused", "Pendant light overhead", "Dramatic side light"],
  },
  {
    label: "Props & Styling",
    chips: ["Indoor plants", "Coffee table books", "Throw blanket", "Candles", "Fresh flowers", "Artwork on wall", "Floor lamp", "Rug beneath furniture"],
  },
  {
    label: "Colour Palette",
    chips: ["Neutral whites", "Warm earth tones", "Cool greys", "Rich jewel tones", "Pastel soft tones", "Monochrome", "Navy and brass", "Green and natural"],
  },
  {
    label: "Window & View",
    chips: ["Floor-to-ceiling windows", "Sash windows", "Garden view", "City skyline", "Ocean view", "Courtyard", "No window visible", "Skylights"],
  },
  {
    label: "Mood & Atmosphere",
    chips: ["Calm and serene", "Dramatic and moody", "Bright and airy", "Warm and cosy", "Luxurious", "Rustic and honest", "Fresh and coastal", "Minimal and stark"],
  },
  {
    label: "Season & Time",
    chips: ["Spring morning", "Summer afternoon", "Autumn golden hour", "Winter evening", "Blue hour dusk", "Midday sun", "Rainy day soft light"],
  },
];
