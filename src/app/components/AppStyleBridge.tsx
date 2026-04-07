import { useEffect } from "react";
import { useAuthSession } from "../context/AuthSessionContext";
import { resolveStyleByRole, useStyleStore } from "../stores/useStyleStore";

export function AppStyleBridge() {
  const { role } = useAuthSession();
  const baseStylePreference = useStyleStore((state) => state.baseStylePreference);
  const nightMode = useStyleStore((state) => state.nightMode);

  useEffect(() => {
    const resolvedStyle = resolveStyleByRole(role, baseStylePreference, nightMode);
    const root = document.documentElement;

    root.dataset.appRole = role;
    root.dataset.appStyle = resolvedStyle;
  }, [role, baseStylePreference, nightMode]);

  return null;
}
