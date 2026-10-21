import { BookOpen, Brain, RotateCcw, Shuffle } from "lucide-react";
import type { PracticeMode } from "../../types";

export const modeIcons: Record<PracticeMode, typeof BookOpen> = {
  sequence: BookOpen,
  random: Shuffle,
  weighted: Brain,
  wrong: RotateCcw
};

export const practiceModes: PracticeMode[] = ["sequence", "random", "weighted", "wrong"];

export const isPracticeMode = (value: string | null): value is PracticeMode =>
  value === "sequence" || value === "random" || value === "weighted" || value === "wrong";
