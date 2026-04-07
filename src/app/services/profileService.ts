import { UserProfile } from "../models/profile";
import { readFromStorage, writeToStorage } from "./storage";

const CLAVE_NOTIFICACIONES = "saludavisa.profile.notifications";
const CLAVE_CUIDADORES = "saludavisa.profile.caregivers";

type UsuarioBase = Pick<UserProfile, "id" | "name" | "email" | "role" | "age">;

function keyPorUsuario(base: string, userId: string): string {
  return `${base}.${userId}`;
}

function avatarPorRol(role: UserProfile["role"]): string {
  if (role === "familiar_cuidador") {
    return "👪";
  }
  return "👵";
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

  return {
    ...usuario,
    avatarEmoji: avatarPorRol(usuario.role),
    emergencyPhone: "900 123 456",
    notifications,
    caregivers,
  };
}

export const servicioPerfil = {
  obtener(usuario: UsuarioBase): UserProfile {
    return perfilBase(usuario);
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
};

export const profileService = {
  get: servicioPerfil.obtener,
  updateNotifications: servicioPerfil.actualizarNotificaciones,
  addCaregiver: servicioPerfil.agregarCuidador,
};
