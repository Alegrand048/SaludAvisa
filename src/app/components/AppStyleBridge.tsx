import { useEffect } from "react";
import { useAuthSession } from "../context/AuthSessionContext";
import { resolveStyleByRole, resolveTextSizeByRole, useStyleStore } from "../stores/useStyleStore";

export function AppStyleBridge() {
  const { role } = useAuthSession();
  const baseStylePreference = useStyleStore((state) => state.baseStylePreference);
  const nightMode = useStyleStore((state) => state.nightMode);
  const textSizePreference = useStyleStore((state) => state.textSizePreference);

  useEffect(() => {
    const resolvedStyle = resolveStyleByRole(role, baseStylePreference, nightMode);
    const resolvedTextSize = resolveTextSizeByRole(role, textSizePreference);
    const root = document.documentElement;

    root.dataset.appRole = role;
    root.dataset.appStyle = resolvedStyle;
    root.dataset.appTextSize = resolvedTextSize;
  }, [role, baseStylePreference, nightMode, textSizePreference]);

  return null;
}
