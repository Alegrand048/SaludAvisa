import { UserProfile } from "../models/profile";
import { readFromStorage, writeToStorage } from "./storage";
import { supabase } from "./supabaseClient";

const CLAVE_NOTIFICACIONES = "saludavisa.profile.notifications";
const CLAVE_CUIDADORES = "saludavisa.profile.caregivers";
const CLAVE_APARIENCIA = "saludavisa.profile.appearance";

type UsuarioBase = Pick<UserProfile, "id" | "name" | "email" | "role" | "age">;

interface ProfileAppearance {
  name?: string;
  avatarUrl?: string;
}

interface PerfilRow {
  usuario_id: string;
  nombre_completo: string | null;
  email: string | null;
  avatar_url?: string | null;
  avatar_emoji?: string | null;
}

function isAvatarUrlCandidate(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("data:image") || trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

function resolveAvatarFromRow(row: PerfilRow | null): string | undefined {
  if (!row) {
    return undefined;
  }
  if (isAvatarUrlCandidate(row.avatar_url)) {
    return row.avatar_url!.trim();
  }
  if (isAvatarUrlCandidate(row.avatar_emoji)) {
    return row.avatar_emoji!.trim();
  }
  return undefined;
}

function keyPorUsuario(base: string, userId: string): string {
  return `${base}.${userId}`;
}

function perfilBase(usuario: UsuarioBase): UserProfile {
  const notifications = readFromStorage<UserProfile["notifications"]>(
    keyPorUsuario(CLAVE_NOTIFICACIONES, usuario.id),
    {
      medicationReminders: true,
      appointmentReminders: true,
      soundEnabled: true,
    },
  );

  const caregivers = readFromStorage<UserProfile["caregivers"]>(
    keyPorUsuario(CLAVE_CUIDADORES, usuario.id),
    [],
  );

  const appearance = readFromStorage<ProfileAppearance>(keyPorUsuario(CLAVE_APARIENCIA, usuario.id), {});

  return {
    ...usuario,
    name: appearance.name?.trim() || usuario.name,
    avatarEmoji: "",
    avatarUrl: appearance.avatarUrl,
    emergencyPhone: "900 123 456",
    notifications,
    caregivers,
  };
}

async function upsertPerfilRemoto(usuario: UsuarioBase, appearance: ProfileAppearance): Promise<void> {
  const payloadConAvatar = {
    usuario_id: usuario.id,
    nombre_completo: appearance.name?.trim() || usuario.name,
    email: usuario.email,
    avatar_url: appearance.avatarUrl ?? null,
  };

  const { error } = await supabase.from("perfiles").upsert(payloadConAvatar, { onConflict: "usuario_id" });
  if (!error) {
    return;
  }

  // Fallback when avatar_url column is not deployed yet.
  if (error.message.toLowerCase().includes("avatar_url") || error.message.toLowerCase().includes("column")) {
    const payloadSinAvatar = {
      usuario_id: usuario.id,
      nombre_completo: appearance.name?.trim() || usuario.name,
      email: usuario.email,
      avatar_emoji: appearance.avatarUrl ?? "",
    };
    const { error: legacyError } = await supabase.from("perfiles").upsert(payloadSinAvatar, { onConflict: "usuario_id" });
    if (legacyError) {
      throw new Error(legacyError.message);
    }
    return;
  }

  throw new Error(error.message);
}

export const servicioPerfil = {
  obtener(usuario: UsuarioBase): UserProfile {
    return perfilBase(usuario);
  },

  async obtenerAsync(usuario: UsuarioBase): Promise<UserProfile> {
    const base = perfilBase(usuario);

    const { data } = await supabase
      .from("perfiles")
      .select("usuario_id, nombre_completo, email, avatar_url, avatar_emoji")
      .eq("usuario_id", usuario.id)
      .maybeSingle();

    const row = data as PerfilRow | null;
    const merged: UserProfile = {
      ...base,
      name: row?.nombre_completo?.trim() || base.name,
      avatarUrl: resolveAvatarFromRow(row) || base.avatarUrl,
      email: row?.email?.trim() || base.email,
    };

    writeToStorage(keyPorUsuario(CLAVE_APARIENCIA, usuario.id), {
      name: merged.name,
      avatarUrl: merged.avatarUrl,
    });

    // Ensure profile row exists and stays aligned.
    await upsertPerfilRemoto(usuario, {
      name: merged.name,
      avatarUrl: merged.avatarUrl,
    });

    return merged;
  },

  actualizarNotificaciones(usuario: UsuarioBase, notificaciones: UserProfile["notifications"]): UserProfile {
    writeToStorage(keyPorUsuario(CLAVE_NOTIFICACIONES, usuario.id), notificaciones);
    return perfilBase(usuario);
  },

  agregarCuidador(
    usuario: UsuarioBase,
    nuevoCuidador: Pick<UserProfile["caregivers"][number], "name" | "role" | "phone">,
  ): UserProfile {
    const key = keyPorUsuario(CLAVE_CUIDADORES, usuario.id);
    const cuidadoresActuales = readFromStorage<UserProfile["caregivers"]>(key, []);
    const emoji = nuevoCuidador.role.toLowerCase().includes("hijo")
      ? "👨"
      : nuevoCuidador.role.toLowerCase().includes("hija")
        ? "👩"
        : "🧑";
    const actualizado = [
      ...cuidadoresActuales,
      {
        id: crypto.randomUUID(),
        name: nuevoCuidador.name,
        role: nuevoCuidador.role,
        phone: nuevoCuidador.phone,
        emoji,
      },
    ];
    writeToStorage(key, actualizado);
    return perfilBase(usuario);
  },

  actualizarApariencia(
    usuario: UsuarioBase,
    apariencia: ProfileAppearance,
  ): UserProfile {
    writeToStorage(keyPorUsuario(CLAVE_APARIENCIA, usuario.id), {
      name: apariencia.name?.trim() || usuario.name,
      avatarUrl: apariencia.avatarUrl,
    });
    return perfilBase(usuario);
  },

  async actualizarAparienciaAsync(
    usuario: UsuarioBase,
    apariencia: ProfileAppearance,
  ): Promise<UserProfile> {
    const updatedProfile = perfilBase({
      ...usuario,
      name: apariencia.name?.trim() || usuario.name,
    });

    writeToStorage(keyPorUsuario(CLAVE_APARIENCIA, usuario.id), {
      name: updatedProfile.name,
      avatarUrl: apariencia.avatarUrl,
    });

    try {
      await upsertPerfilRemoto(usuario, apariencia);
      return {
        ...updatedProfile,
        avatarUrl: apariencia.avatarUrl ?? updatedProfile.avatarUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("infinite recursion") || message.includes("miembros_familia")) {
        // DB policy issue: keep UX working with local profile while SQL policy is fixed.
        return {
          ...updatedProfile,
          avatarUrl: apariencia.avatarUrl ?? updatedProfile.avatarUrl,
        };
      }
      throw error;
    }
  },
};

export const profileService = {
  get: servicioPerfil.obtener,
  getAsync: servicioPerfil.obtenerAsync,
  updateNotifications: servicioPerfil.actualizarNotificaciones,
  addCaregiver: servicioPerfil.agregarCuidador,
  updateAppearance: servicioPerfil.actualizarApariencia,
  updateAppearanceAsync: servicioPerfil.actualizarAparienciaAsync,
};
