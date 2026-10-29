import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type Level = "beginner" | "intermediate" | "advanced";

interface Prefs {
  theme: Theme;
  level: Level;
  reduceMotion: boolean;
  largeText: boolean;
  notifyQuizReminders: boolean;
  notifyAchievements: boolean;
  set: (p: Partial<Omit<Prefs, "set">>) => void;
}

export const usePreferences = create<Prefs>()(
  persist(
    (set) => ({
      theme: "light",
      level: "beginner",
      reduceMotion: false,
      largeText: false,
      notifyQuizReminders: true,
      notifyAchievements: true,
      set: (p) => set(p),
    }),
    { name: "chakravyuh-prefs-v1" },
  ),
);

export function applyPreferences(p: Pick<Prefs, "theme" | "reduceMotion" | "largeText">) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = p.theme === "dark" || (p.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.classList.toggle("reduce-motion", p.reduceMotion);
  root.classList.toggle("text-large", p.largeText);
}
