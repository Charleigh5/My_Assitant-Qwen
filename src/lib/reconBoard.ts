/**
 * RECON — 3D reconstruction reference-board generator (spec v1.0).
 * Turns an object description into an engineering-sheet-style board:
 * hero iso, ortho set, silhouette diagram, macro details, markings,
 * material/PBR palette, section view, camera table, build pipeline,
 * Visual Gauntlet and defect taxonomy. Evidence is stamped honestly —
 * with text-only input, geometry is ARTIST_AUTHORED, never "verified".
 */

export type SectionKey =
  | "hero"
  | "ortho"
  | "silhouette"
  | "macro"
  | "markings"
  | "materials"
  | "section"
  | "cameras";

export interface BoardSection {
  key: SectionKey;
  num: string;
  title: string;
  caption: string;
  image: boolean;
  status: "static" | "queued" | "rendering" | "done" | "fallback";
  src?: string;
  method?: "ai" | "procedural";
  seed: number;
}

export interface MaterialSpec {
  name: string;
  colorName: string;
  hex: string;
  roughness: number;
  metallic: number;
  specular: number;
  ior: number;
  normal: string;
  bump: number;
  extras?: string;
  micro: string;
}

export interface Board {
  id: string;
  object: string;
  createdAt: number;
  rev: string;
  seed: number;
  sections: BoardSection[];
  materials: MaterialSpec[];
}

/* ---------- spec constants (§12–§16) ---------- */

export const GAUNTLET: { step: string; note: string }[] = [
  { step: "Camera alignment", note: "match board cameras before judging anything" },
  { step: "Silhouette", note: "outline must match at every ortho view" },
  { step: "Overall proportions", note: "L/W/H relationships within tolerance" },
  { step: "Major masses", note: "primary volumes read correctly" },
  { step: "Attachment positions", note: "hardware lands where the board says" },
  { step: "Gaps / intersections / contact", note: "no clipping, no floating parts" },
  { step: "Panel and seam paths", note: "seams follow the map, not texture lines" },
  { step: "Edge radii", note: "no infinitely sharp CAD edges" },
  { step: "Secondary geometry", note: "vents, grips, recesses present" },
  { step: "Branding placement", note: "markings positioned and scaled per atlas" },
  { step: "Materials", note: "palette applied to correct surfaces" },
  { step: "Surface texture", note: "grain/weave/brushing at true scale" },
  { step: "Roughness / specular response", note: "reads right under neutral light" },
  { step: "Microdetail", note: "imperfections, wear, molding marks" },
  { step: "Lighting / shadows", note: "neutral validation rig only" },
];

export const DEFECT_CLASSES = [
  "SILHOUETTE_ERROR",
  "PROPORTION_ERROR",
  "CAMERA_ERROR",
  "POSITION_ERROR",
  "ROTATION_ERROR",
  "ATTACHMENT_ERROR",
  "INTERSECTION_ERROR",
  "GAP_ERROR",
  "CURVATURE_ERROR",
  "SEAM_ERROR",
  "TOPOLOGY_ERROR",
  "MATERIAL_ERROR",
  "COLOR_ERROR",
  "ROUGHNESS_ERROR",
  "TEXTURE_SCALE_ERROR",
  "BRANDING_ERROR",
  "LIGHTING_ERROR",
  "UNKNOWN_SOURCE_DETAIL",
];

export const STRATEGY_STAGES = [
  "REFERENCE CLEANUP",
  "CAMERA CALIBRATION",
  "UNITS / SCALE",
  "PRIMARY SILHOUETTE",
  "MAJOR MASSES",
  "PANEL / PART BREAKDOWN",
  "ATTACHMENTS",
  "SECONDARY FORMS",
  "SEAMS",
  "TOPOLOGY",
  "UVs",
  "MATERIALS",
  "BRANDING",
  "MICRODETAIL",
  "LIGHTING",
  "CAMERA MATCH",
  "VISUAL QA",
];

export const STRATEGY_TOOLBOX = [
  { part: "Primary shell", tool: "Subdivision modeling + bevel workflow" },
  { part: "Hard edges / trim", tool: "Weighted normals, hold edges — not booleans" },
  { part: "Seams & panel gaps", tool: "Real geometry insets (solidify + inset), not painted lines" },
  { part: "Repeating hardware", tool: "Geometry Nodes array or curve-based instancing" },
  { part: "Organic grips / pads", tool: "Sculpt + retopology, shrinkwrap to shell" },
  { part: "Stitching / laces", tool: "Curve with bevel object, instanced stitch segments" },
  { part: "Microdetail", tool: "Normal/bump maps first; displacement only silhouette-critical" },
  { part: "Branding", tool: "Decal projection + curvature-aware UV islands" },
];

export const CAMERAS = [
  "CAM_FRONT_ORTHO",
  "CAM_BACK_ORTHO",
  "CAM_LEFT_ORTHO",
  "CAM_RIGHT_ORTHO",
  "CAM_TOP_ORTHO",
  "CAM_BOTTOM_ORTHO",
  "CAM_ISO_HERO",
  "CAM_DETAIL_01…N",
];

export const LIGHTING_RIG = [
  "Large soft key (area, ~45° elev / 30° azim)",
  "Weaker fill (¼ key intensity, opposite side)",
  "Controlled rim (grazing, edge definition only)",
  "Neutral world illumination (no colored bounce)",
  "Soft contact shadow on neutral floor",
  "Physically plausible reflections, no HDRI heroes",
];

export const EVIDENCE = {
  verified: 0,
  legend: [
    { tag: "SOURCE_VERIFIED", note: "directly visible in references", tone: "#9be15d" },
    { tag: "MEASURED", note: "from supplied dimensions", tone: "#54d8ff" },
    { tag: "ESTIMATED", note: "derived from prompt only", tone: "#f5b94b" },
    { tag: "ARTIST_AUTHORED", note: "completion of hidden geometry", tone: "#ff7a50" },
    { tag: "UNKNOWN_SOURCE_DETAIL", note: "reference required", tone: "#8cacac" },
  ],
};

/* ---------- material heuristics (§7–§8) ---------- */

interface Preset extends MaterialSpec {}

const MAT_LEATHER: Preset = {
  name: "MAT_PRIMARY_LEATHER",
  colorName: "Saddle Tan",
  hex: "#7A4E2E",
  roughness: 0.52,
  metallic: 0,
  specular: 0.5,
  ior: 1.5,
  normal: "pebbled grain, 0.5 strength",
  bump: 0.35,
  extras: "clearcoat 0.12 @ rough 0.4",
  micro: "Pebbling 0.4–0.8 mm cells; pores cluster along stitch rows; edge paint lines at panel borders.",
};

const MAT_METAL: Preset = {
  name: "MAT_PRIMARY_ALLOY",
  colorName: "Brushed Steel",
  hex: "#C2C8CE",
  roughness: 0.3,
  metallic: 1,
  specular: 0.8,
  ior: 2.5,
  normal: "directional brushing, 0.25 strength",
  bump: 0.12,
  extras: "anisotropy 0.6 along brush axis",
  micro: "Brushing runs along the long axis; machining marks ring any turned feature; fingerprints in gloss zones.",
};

const MAT_POLYMER: Preset = {
  name: "MAT_PRIMARY_POLYMER",
  colorName: "Soft-Touch Graphite",
  hex: "#33363B",
  roughness: 0.46,
  metallic: 0,
  specular: 0.5,
  ior: 1.46,
  normal: "mold speckle, 0.15 strength",
  bump: 0.08,
  extras: "sheen 0.2 for soft-touch grades",
  micro: "Fine injection-mold speckle; witness line at the parting plane; ejector-pin dimples on hidden faces.",
};

const MAT_WOOD: Preset = {
  name: "MAT_PRIMARY_WOOD",
  colorName: "Oiled Walnut",
  hex: "#7C5636",
  roughness: 0.58,
  metallic: 0,
  specular: 0.5,
  ior: 1.5,
  normal: "open grain, 0.4 strength",
  bump: 0.3,
  extras: "clearcoat 0.25 @ rough 0.35 (oiled finish)",
  micro: "Open grain with cathedral figure on wide faces; end grain shows pore clusters; slight raised grain near edges.",
};

const MAT_TEXTILE: Preset = {
  name: "MAT_PRIMARY_TEXTILE",
  colorName: "Waxed Canvas",
  hex: "#6E6A58",
  roughness: 0.88,
  metallic: 0,
  specular: 0.35,
  ior: 1.4,
  normal: "2/1 twill weave, 0.6 strength",
  bump: 0.5,
  extras: "sheen 0.5, sheen tint warm",
  micro: "Twill weave ~0.6 mm repeat; fiber fuzz catches raking light; wax pooling creases at fold zones.",
};

const MAT_GLASS: Preset = {
  name: "MAT_PRIMARY_GLASS",
  colorName: "Borosilicate",
  hex: "#E8F1EF",
  roughness: 0.06,
  metallic: 0,
  specular: 1,
  ior: 1.52,
  normal: "—",
  bump: 0,
  extras: "transmission 0.94 · thickness 0.004",
  micro: "Fire-polished rims; faint vertical mold seam; caustics only under validation light if required.",
};

const MAT_RUBBER: Preset = {
  name: "MAT_PRIMARY_ELASTOMER",
  colorName: "Vulcanized Black",
  hex: "#26262B",
  roughness: 0.78,
  metallic: 0,
  specular: 0.4,
  ior: 1.45,
  normal: "diamond knurl, 0.5 strength",
  bump: 0.4,
  micro: "Knurl pitch ~1.2 mm; mold flash line around perimeter; matte dusting in recesses.",
};

const MAT_CERAMIC: Preset = {
  name: "MAT_PRIMARY_CERAMIC",
  colorName: "Glazed Stoneware",
  hex: "#E3DDD2",
  roughness: 0.28,
  metallic: 0,
  specular: 0.6,
  ior: 1.55,
  normal: "orange peel, 0.12 strength",
  bump: 0.06,
  extras: "clearcoat 0.7 @ rough 0.2",
  micro: "Orange peel at glaze breaks; foot ring left raw; pinholes cluster near the rim.",
};

const MAT_CARBON: Preset = {
  name: "MAT_PRIMARY_COMPOSITE",
  colorName: "2×2 Twill Carbon",
  hex: "#2A2C30",
  roughness: 0.34,
  metallic: 0.4,
  specular: 0.9,
  ior: 1.8,
  normal: "twill weave, 0.45 strength",
  bump: 0.2,
  extras: "clearcoat 1.0 @ rough 0.12",
  micro: "Tow width ~2 mm; weave must follow tube curvature — never flat-projected; clear-coat orange peel on top.",
};

const PRESET_MAP: [RegExp, Preset][] = [
  [/leather|saddle|boot|wallet|belt|briefcase|satchel/i, MAT_LEATHER],
  [/metal|steel|aluminum|aluminium|chrome|titanium|knife|tool|robot|engine|watch/i, MAT_METAL],
  [/carbon|composite/i, MAT_CARBON],
  [/wood|walnut|oak|chair|table|guitar|violin/i, MAT_WOOD],
  [/fabric|canvas|denim|hoodie|jacket|tent|backpack|shoe|sneaker/i, MAT_TEXTILE],
  [/glass|bottle|lens|decanter|jar/i, MAT_GLASS],
  [/rubber|tire|grip|sole|mat|tube/i, MAT_RUBBER],
  [/ceramic|mug|porcelain|vase|teapot|plate/i, MAT_CERAMIC],
  [/plastic|abs|polycarbonate|headphone|console|controller|toy|camera|espresso|machine/i, MAT_POLYMER],
];

const MAT_HARDWARE: Preset = {
  name: "MAT_HARDWARE_STEEL",
  colorName: "Dark Oxidized Steel",
  hex: "#454A52",
  roughness: 0.3,
  metallic: 1,
  specular: 0.8,
  ior: 2.5,
  normal: "machined tool marks, 0.2",
  bump: 0.1,
  micro: "Phillips/torx recesses show tool wear; screw heads sit 0.1 mm proud or flush per spec.",
};

const MAT_CONTACT: Preset = {
  name: "MAT_CONTACT_RUBBER",
  colorName: "Foot Pad Black",
  hex: "#212126",
  roughness: 0.85,
  metallic: 0,
  specular: 0.35,
  ior: 1.45,
  normal: "—",
  bump: 0.2,
  micro: "Scuff marks align with the contact plane; dust embeds at edges.",
};

function secondaryFor(primary: Preset): Preset {
  if (primary.name.includes("LEATHER")) return { ...MAT_TEXTILE, name: "MAT_SECONDARY_CANVAS", colorName: "Bonded Canvas" };
  if (primary.name.includes("ALLOY")) return { ...MAT_POLYMER, name: "MAT_SECONDARY_OVERMOLD", colorName: "Polymer Overmold" };
  if (primary.name.includes("TEXTILE")) return { ...MAT_LEATHER, name: "MAT_SECONDARY_LEATHER_TRIM", colorName: "Veg-Tan Trim" };
  return { ...MAT_METAL, name: "MAT_SECONDARY_ALLOY_TRIM", colorName: "Milled Alloy Trim", roughness: 0.22 };
}

export function deriveMaterials(object: string): MaterialSpec[] {
  const hit = PRESET_MAP.find(([re]) => re.test(object));
  const primary = hit ? hit[1] : MAT_POLYMER;
  return [primary, secondaryFor(primary), MAT_HARDWARE, MAT_CONTACT];
}

/* ---------- prompts (§2–§6, §9) ---------- */

const ANCHOR =
  "same object in every view, identical silhouette, colors and proportions, neutral light-gray studio background, physically plausible soft studio lighting, sharp, photorealistic technical reference, no watermark, no decorative clutter";

export function sectionPrompt(object: string, key: SectionKey, seed: number): string {
  switch (key) {
    case "hero":
      return `Photorealistic three-quarter isometric hero rendering of ${object}, centered, full silhouette visible, length-width-height relationships clear, gentle studio key light with soft fill and rim, subtle contact shadow on neutral floor, long focal length, no exaggerated perspective. ${ANCHOR}`;
    case "ortho":
      return `Orthographic CAD-style technical turnaround of ${object}: FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM views arranged in one neat row, exact orthographic projection, zero perspective distortion, identical scale orientation and object across all six views, thin alignment guidelines, engineering drawing layout. ${ANCHOR}`;
    case "macro":
      return `Macro detail callout sheet of ${object}: several enlarged close-up frames showing seams, fasteners, edge radii, vents, grips and surface texture, thin leader lines with tiny functional labels, technical illustration on neutral background. ${ANCHOR}`;
    case "markings":
      return `Enlarged markings and branding atlas of ${object}: close-up grid of logos, model designation, certification marks, warnings, decals and engraved or printed text with position notes; use abstract placeholder glyphs where text cannot be resolved. ${ANCHOR}`;
    case "section":
      return `Exploded cross-section construction diagram of ${object}: outer shell, inner frame and internal components separated along a central axis with thin leader lines and part labels, clean technical vector-illustration style, neutral background. ${ANCHOR}`;
    default:
      return "";
  }
}

/* ---------- board factory ---------- */

export function createBoard(object: string): Board {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const mk = (
    key: SectionKey,
    num: string,
    title: string,
    caption: string,
    image: boolean,
  ): BoardSection => ({
    key,
    num,
    title,
    caption,
    image,
    status: image ? "queued" : "static",
    seed,
  });

  return {
    id: `board-${Date.now().toString(36)}`,
    object,
    createdAt: Date.now(),
    rev: "A",
    seed,
    materials: deriveMaterials(object),
    sections: [
      mk("hero", "§A", "HERO / MASTER REFERENCE", "Three-quarter isometric · long lens · neutral rig", true),
      mk("ortho", "§B", "ORTHOGRAPHIC VIEW SET", "F·B·L·R·T·B — shared scale and axes", true),
      mk("silhouette", "§C", "SILHOUETTE + PROPORTION GUIDE", "Principal axes · centerline · contact plane", false),
      mk("macro", "§D", "ISOMETRIC MACRO DETAILS", "Seams · fasteners · radii · texture", true),
      mk("markings", "§E", "MARKINGS / TYPOGRAPHY ATLAS", "Logos · labels · method of application", true),
      mk("materials", "§F", "3D MATERIAL PALETTE", "PBR calibration starting values", false),
      mk("section", "§G", "CROSS-SECTION / CONSTRUCTION", "Shell · frame · internals · hardware", true),
      mk("cameras", "§H", "CAMERA · LIGHTING · QA", "Canonical cameras · neutral rig · gauntlet", false),
    ],
  };
}

export const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
};

/* ---------- sheet export ---------- */

export async function exportSheet(board: Board): Promise<string | null> {
  try {
    const imageSections = board.sections.filter((s) => s.image && s.src);
    const imgs = await Promise.all(
      imageSections.map(
        (s) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.crossOrigin = "anonymous";
            im.onload = () => res(im);
            im.onerror = () => rej(new Error("load"));
            im.src = s.src!;
          }),
      ),
    );
    const W = 3200;
    const H = 2000;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#101820";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#2f4c59";
    g.lineWidth = 3;
    g.strokeRect(24, 24, W - 48, H - 48);

    g.fillStyle = "#eaf4f3";
    g.font = "900 96px Unbounded, sans-serif";
    g.fillText(board.object.toUpperCase(), 72, 170);
    g.fillStyle = "#3fe0c5";
    g.font = "500 34px 'JetBrains Mono', monospace";
    g.fillText(
      `3D RECONSTRUCTION MASTER · REV ${board.rev} · SEED ${board.seed} · ESTIMATED FROM PROMPT — ARTIST_AUTHORED GEOMETRY`,
      72,
      232,
    );

    const slots = [
      [72, 300, 1500, 760],
      [1628, 300, 1500, 760],
      [72, 1116, 1500, 760],
      [1628, 1116, 1500, 760],
      [72, 300, 0, 0],
    ];
    imageSections.slice(0, 5).forEach((s, i) => {
      const [x, y, w, h] = slots[i];
      if (!w) return;
      const im = imgs[i];
      g.strokeStyle = "#2f4c59";
      g.strokeRect(x, y, w, h);
      const scale = Math.max(w / im.width, h / im.height);
      const dw = im.width * scale;
      const dh = im.height * scale;
      g.fillStyle = "#0b1317";
      g.fillRect(x, y, w, h);
      g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      g.fillStyle = "#8cacac";
      g.font = "500 26px 'JetBrains Mono', monospace";
      g.fillText(`${s.num} ${s.title}`, x + 12, y + h - 16);
    });
    return cv.toDataURL("image/png");
  } catch {
    return null;
  }
}
