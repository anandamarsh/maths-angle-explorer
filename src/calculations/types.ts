export interface KnownEgg {
  angleDeg: number;
  label: string;
}

export interface AngleSector {
  fromAngle: number;
  toAngle: number;
  label?: string;
  missing?: boolean;
}

export interface AngleQuestion {
  id: string;
  level: 1 | 2 | 3;
  prompt: string;
  answer: number;
  promptLines?: [string, string, string];
  subAnswers?: [number, number, number];
  knownEggs: KnownEgg[];
  hiddenAngleDeg: number;
  totalContext: 90 | 180 | 360;
  startAngleDeg?: number;
  setKind?: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
  sectorArcs?: AngleSector[];
  dividerAngles?: number[];
}

export type GameRound = "normal" | "monster" | "platinum";
