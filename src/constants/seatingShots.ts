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
    promptHint: "Photograph the exact product from the reference images at a 45-degree angle, showing the front face, one arm, the seat, backrest, and legs clearly visible. Camera positioned at 45 degrees to the front-left corner of the furniture, at seated eye level (approximately 90cm height). Frame the full piece with equal visual weight on the front face and one side panel. Both armrests, the upper back, and all four legs must be clearly visible. Use a wide-normal lens (50mm equivalent) with the product centred in the frame occupying roughly 70% of the image width. This is the primary hero product shot. The furniture must match the reference images exactly — same shape, materials, colours, and details.",
  },
  {
    id: "front",
    number: 2,
    label: "Front Straight-On",
    group: "Standard Views",
    description: "Dead centre, full width, cushion arrangement, symmetry",
    cameraAngle: "eye_level",
    promptHint: "Photograph the exact product from the reference images from dead centre front, perfectly symmetrical, showing full width. Camera placed directly in front of the furniture, perfectly centred on the horizontal midpoint, at seated eye level. The lens axis is perpendicular to the front face — zero angle, dead straight. Frame the full width edge-to-edge with minimal margins. Emphasise bilateral symmetry, the cushion arrangement across the full seat width, and the front face proportions. No side panels should be visible. The furniture must be identical to the reference images.",
  },
  {
    id: "side",
    number: 3,
    label: "Side Profile",
    group: "Standard Views",
    description: "Pure 90° side view showing seat depth, back height, arm height, leg style",
    cameraAngle: "side_profile",
    promptHint: "Photograph the exact product from the reference images from a pure 90-degree side view, showing seat depth, arm height, back height, and leg profile. Camera positioned at exactly 90 degrees to the side of the furniture, at seated eye level, creating a pure profile silhouette. Frame the piece to show the full depth from front edge to back, full height from floor to top of back. Clearly reveal the seat depth, back angle and height, armrest height and shape, and leg style in a clean side elevation. No front face should be visible — this is a strict orthographic side view. The furniture must match the reference images exactly.",
  },
  {
    id: "rear",
    number: 4,
    label: "Rear 3/4 Angle",
    group: "Standard Views",
    description: "Back construction, back panel finish, legs from behind",
    cameraAngle: "corner_view",
    promptHint: "Photograph the exact product from the reference images from behind at a 45-degree angle, showing back panel construction, back finish, and rear legs. Camera positioned behind and to one side of the furniture at a 45-degree rear angle, slightly elevated (approximately 120cm height looking down at 15 degrees). Show the back panel construction, upholstery finish on the rear, and the legs as seen from behind. The front face should NOT be visible. This shot reveals build quality and back-panel detailing. The furniture must be identical to the reference images — same materials, colours, and construction.",
  },
  {
    id: "topdown",
    number: 5,
    label: "Top-Down / Bird's Eye",
    group: "Standard Views",
    description: "Straight down, overall footprint, cushion layout",
    cameraAngle: "elevated",
    promptHint: "Photograph the exact product from the reference images from directly above, looking straight down, showing the full footprint, cushion layout, and seat shape. Camera positioned directly above the furniture looking straight down at a perfect 90-degree overhead angle. The lens axis points vertically downward. Frame the entire footprint within the image, showing the complete cushion layout, seat surface pattern, armrest tops, and overall rectangular or curved outline from above. No side faces should be visible — this is a strict plan view showing only the top surface and overall shape. The furniture must match the reference images exactly.",
  },
  {
    id: "fabric",
    number: 6,
    label: "Close-Up: Fabric Texture",
    group: "Close-Ups",
    description: "Macro of upholstery weave, grain, or pile",
    cameraAngle: "eye_level",
    promptHint: "Extreme close-up macro shot of the upholstery material on the exact product from the reference images, filling the entire frame with the fabric texture, weave pattern, or leather grain — no full furniture visible, just the material surface. Camera is 20-30cm from the surface with a macro lens at f/2.8 for shallow depth of field. Show individual thread weave, fabric grain direction, pile texture, or leather grain in sharp detail. The background should be softly blurred fabric falling out of focus. No other furniture parts should be identifiable — only raw material texture. The material must match the exact fabric/leather from the reference images.",
  },
  {
    id: "stitching",
    number: 7,
    label: "Close-Up: Cushion & Stitching",
    group: "Close-Ups",
    description: "Piping, tufting, welt seams, cushion depth",
    cameraAngle: "eye_level",
    promptHint: "Extreme close-up of the stitching and cushion detail on the exact product from the reference images — show piping, tufting, welt seams, or button detail filling the frame, not the full piece of furniture. Frame a 20cm × 20cm area where cushion panels meet, showing the stitching craftsmanship, thread quality, piping cord, and cushion edge depth. Camera angle is slightly oblique (30 degrees from surface) to reveal the three-dimensional depth of the seam and cushion loft. Use shallow depth of field with the stitch line in razor-sharp focus. The stitching and materials must match the reference images exactly.",
  },
  {
    id: "leg",
    number: 8,
    label: "Close-Up: Leg Detail",
    group: "Close-Ups",
    description: "Leg material, finish, and style",
    cameraAngle: "low_angle",
    promptHint: "Extreme close-up of one leg and foot of the exact product from the reference images — show the leg material, finish, shape, and how it meets the floor, filling the frame with just the leg detail. Camera is at floor level, 25-35cm from the leg, angled slightly upward. Fill the frame with the leg showing its full length from floor contact point to where it meets the seat frame. Reveal the material (wood grain, metal finish, or painted surface), any turned or tapered shaping, foot caps or glides, and joinery where the leg connects to the body. Background is the floor surface with strong bokeh blur. The leg must match the reference images exactly.",
  },
  {
    id: "lifestyle",
    number: 9,
    label: "Lifestyle / In-Room",
    group: "Lifestyle",
    description: "Full styled room environment, the emotional sell",
    cameraAngle: "eye_level",
    promptHint: "The exact product from the reference images placed in a fully styled living room environment, wide shot showing the complete room with the furniture as the centrepiece. Camera at standing eye level (150cm), positioned 3-4 metres back to include surrounding decor — side tables, rugs, lamps, plants, artwork on walls. Warm natural window light from one side creates soft directional shadows. The furniture occupies the central third of the frame with styled room context filling the remaining space. This is the aspirational, emotional shot that sells the lifestyle. The furniture must be identical to the reference images — same shape, fabric, colour, and every detail preserved.",
  },
];

export const SEATING_GROUPS = ["Standard Views", "Close-Ups", "Lifestyle"] as const;
