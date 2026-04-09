import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StylePreference = "auto" | "senior-clean" | "care-modern";
export type AppRole = "usuario" | "familiar_cuidador";
export type ResolvedStyle = "senior-clean" | "care-modern" | "senior-night" | "care-night";
export type TextSizePreference = "auto" | "normal" | "large";
export type ResolvedTextSize = "normal" | "large";

interface StyleState {
  baseStylePreference: StylePreference;
  nightMode: boolean;
  textSizePreference: TextSizePreference;
  setBaseStylePreference: (style: StylePreference) => void;
  setNightMode: (enabled: boolean) => void;
  setTextSizePreference: (size: TextSizePreference) => void;
}

function normalizeLegacyStyle(raw: unknown): { baseStylePreference: StylePreference; nightMode: boolean } {
  if (raw === "care-night") {
    return { baseStylePreference: "care-modern", nightMode: true };
  }

  if (raw === "senior-clean" || raw === "care-modern" || raw === "auto") {
    return { baseStylePreference: raw, nightMode: false };
  }

  return { baseStylePreference: "auto", nightMode: false };
}

export function resolveStyleByRole(role: AppRole, preference: StylePreference, nightMode: boolean): ResolvedStyle {
  const baseStyle = preference === "auto"
    ? role === "usuario" ? "senior-clean" : "care-modern"
    : preference;

  if (!nightMode) {
    return baseStyle;
  }

  if (baseStyle === "senior-clean") {
    return "senior-night";
  }

  return "care-night";
}

export function resolveTextSizeByRole(role: AppRole, preference: TextSizePreference): ResolvedTextSize {
  if (preference !== "auto") {
    return preference;
  }

  return role === "usuario" ? "large" : "normal";
}

export const useStyleStore = create<StyleState>()(
  persist(
    (set, get) => ({
      baseStylePreference: "auto",
      nightMode: false,
      textSizePreference: "auto",
      setBaseStylePreference: (baseStylePreference) => set({ baseStylePreference }),
      setNightMode: (nightMode) => {
        if (get().nightMode === nightMode) {
          return;
        }
        set({ nightMode });
      },
      setTextSizePreference: (textSizePreference) => set({ textSizePreference }),
    }),
    {
      name: "saludavisa.style.preferences",
      version: 3,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return { baseStylePreference: "auto", nightMode: false, textSizePreference: "auto" };
        }

        if (version < 2) {
          const legacy = persistedState as { stylePreference?: unknown };
          return { ...normalizeLegacyStyle(legacy.stylePreference), textSizePreference: "auto" };
        }

        const next = persistedState as Partial<StyleState>;
        return {
          baseStylePreference: next.baseStylePreference ?? "auto",
          nightMode: next.nightMode ?? false,
          textSizePreference: next.textSizePreference ?? "auto",
        };
      },
    },
  ),
);
