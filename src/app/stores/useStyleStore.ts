import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StylePreference = "auto" | "senior-clean" | "care-modern";
export type AppRole = "usuario" | "familiar_cuidador";
export type ResolvedStyle = "senior-clean" | "care-modern" | "senior-night" | "care-night";

interface StyleState {
  baseStylePreference: StylePreference;
  nightMode: boolean;
  setBaseStylePreference: (style: StylePreference) => void;
  setNightMode: (enabled: boolean) => void;
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

export const useStyleStore = create<StyleState>()(
  persist(
    (set, get) => ({
      baseStylePreference: "auto",
      nightMode: false,
      setBaseStylePreference: (baseStylePreference) => set({ baseStylePreference }),
      setNightMode: (nightMode) => {
        if (get().nightMode === nightMode) {
          return;
        }
        set({ nightMode });
      },
    }),
    {
      name: "saludavisa.style.preferences",
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return { baseStylePreference: "auto", nightMode: false };
        }

        if (version < 2) {
          const legacy = persistedState as { stylePreference?: unknown };
          return normalizeLegacyStyle(legacy.stylePreference);
        }

        const next = persistedState as Partial<StyleState>;
        return {
          baseStylePreference: next.baseStylePreference ?? "auto",
          nightMode: next.nightMode ?? false,
        };
      },
    },
  ),
);
