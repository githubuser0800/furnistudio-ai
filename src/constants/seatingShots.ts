export interface SeatingShot {
  id: string;
  number: number;
  label: string;
  group: "Standard Views" | "Close-Ups" | "Lifestyle";
  description: string;
  cameraAngle: string;
  promptHint: string;
}

export const SEATING_SHOT_LIST: SeatingShot[] = [
  {
    id: "hero",
    number: 1,
    label: "Hero — 3/4 Front Angle",
    group: "Standard Views",
    description: "Primary listing image, camera at ~45°, showing front, side, arms, back, and legs",
    cameraAngle: "corner_view",
    promptHint: "Hero product shot from a 3/4 front angle at approximately 45 degrees, capturing the front face, one side, arm rests, upper back, and all legs in a single balanced composition.",
  },
  {
    id: "front",
    number: 2,
    label: "Front Straight-On",
    group: "Standard Views",
    description: "Dead centre, full width, cushion arrangement, symmetry",
    cameraAngle: "front",
    promptHint: "Perfectly centred front-on view at eye level, emphasising full width, cushion arrangement, and bilateral symmetry.",
  },
  {
    id: "side",
    number: 3,
    label: "Side Profile",
    group: "Standard Views",
    description: "Pure 90° side view showing seat depth, back height, arm height, leg style",
    cameraAngle: "side_profile",
    promptHint: "Pure 90-degree side profile revealing seat depth, back height, arm height, and leg style in clean silhouette.",
  },
  {
    id: "rear",
    number: 4,
    label: "Rear 3/4 Angle",
    group: "Standard Views",
    description: "Back construction, back panel finish, legs from behind",
    cameraAngle: "rear_angle",
    promptHint: "Rear three-quarter angle showing back panel construction, finish quality, and legs visible from behind.",
  },
  {
    id: "topdown",
    number: 5,
    label: "Top-Down / Bird's Eye",
    group: "Standard Views",
    description: "Straight down, overall footprint, cushion layout",
    cameraAngle: "top_down",
    promptHint: "Straight-down bird's eye view capturing the overall footprint, cushion layout, and surface pattern from directly above.",
  },
  {
    id: "fabric",
    number: 6,
    label: "Close-Up: Fabric Texture",
    group: "Close-Ups",
    description: "Macro of upholstery weave, grain, or pile",
    cameraAngle: "macro",
    promptHint: "Extreme close-up macro shot of the upholstery surface, revealing the weave pattern, fabric grain, or pile texture with shallow depth of field.",
  },
  {
    id: "stitching",
    number: 7,
    label: "Close-Up: Cushion & Stitching",
    group: "Close-Ups",
    description: "Piping, tufting, welt seams, cushion depth",
    cameraAngle: "macro",
    promptHint: "Close-up detail shot highlighting piping, tufting, welt seams, and cushion depth with soft background bokeh.",
  },
  {
    id: "leg",
    number: 8,
    label: "Close-Up: Leg Detail",
    group: "Close-Ups",
    description: "Leg material, finish, and style",
    cameraAngle: "macro",
    promptHint: "Close-up of the leg detail showing material, finish quality, joinery, and style with shallow depth of field.",
  },
  {
    id: "lifestyle",
    number: 9,
    label: "Lifestyle / In-Room",
    group: "Lifestyle",
    description: "Full styled room environment, the emotional sell",
    cameraAngle: "eye_level",
    promptHint: "Full lifestyle in-room shot with the product as the hero piece in a beautifully styled living environment, warm natural lighting, editorial photography feel.",
  },
];

export const SEATING_GROUPS = ["Standard Views", "Close-Ups", "Lifestyle"] as const;
