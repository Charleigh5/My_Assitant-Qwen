export type ShapeKind = "cube" | "sphere" | "torus" | "cone" | "cylinder" | "gem" | "knot";

export const SHAPE_KINDS: ShapeKind[] = [
  "cube",
  "sphere",
  "torus",
  "cone",
  "cylinder",
  "gem",
  "knot",
];

export interface SceneObject {
  id: string;
  shape: ShapeKind;
  color: string;
  position: [number, number, number];
  scale: number;
  spin: number;
}

export interface PinnedImage {
  id: string;
  src: string;
  prompt: string;
  slot: number;
  kind?: "image" | "video";
  /** explicit world position → card stays put and is grabbable (mouse + hand) */
  position?: [number, number, number];
}

export const FORGE_COLORS = [
  "#3fe0c5",
  "#ff7a50",
  "#f5b94b",
  "#9be15d",
  "#54d8ff",
  "#ff7ab8",
  "#b48cff",
  "#eaf4f3",
];
