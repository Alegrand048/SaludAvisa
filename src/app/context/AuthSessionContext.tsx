import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";
import { familyGroupService } from "../services/familyGroupService";

export type UserRole = "usuario" | "familiar_cuidador";

function normalizeRole(value: unknown): UserRole {
  if (value === "familiar_cuidador" || value === "cuidador" || value === "familiar" || value === "familiar/cuidador") {
    return "familiar_cuidador";
  }
  return "usuario";
}

function buildDisplayName(user: User | null): string {
  if (!user) {
    return "";
  }
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";
  if (metadataName.trim().length > 0 && !metadataName.includes("@")) {
    return metadataName.trim();
  }
  const localPart = user.email?.split("@")[0] ?? "Usuario";
  return localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

interface AuthSessionContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  role: UserRole;
  displayName: string;
  isCaregiverRole: boolean;
  signOut: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }
      setSession(data.session ?? null);
      setIsLoading(false);
    };

    void hydrate();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setIsLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user?.id || !user.email) {
      return;
    }

    void familyGroupService.acceptPendingInvitations(user.id, user.email);
  }, [session?.user?.id, session?.user?.email]);

  const value = useMemo<AuthSessionContextValue>(() => {
    const user = session?.user ?? null;
    const role = normalizeRole(user?.user_metadata?.role);
    return {
      session,
      user,
      isLoading,
      role,
      displayName: buildDisplayName(user),
      isCaregiverRole: role === "familiar_cuidador",
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error(error.message);
        }
      },
    };
  }, [isLoading, session]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession debe usarse dentro de AuthSessionProvider");
  }
  return context;
}