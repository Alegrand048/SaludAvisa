export interface Cuidador {
  id: string;
  name: string;
  role: string;
  phone: string;
  emoji: string;
}

export interface PreferenciasNotificacion {
  medicationReminders: boolean;
  appointmentReminders: boolean;
  soundEnabled: boolean;
}

export interface PerfilUsuario {
  id: string;
  name: string;
  role: "usuario" | "familiar_cuidador";
  age: number;
  email: string;
  avatarEmoji: string;
  avatarUrl?: string;
  emergencyPhone: string;
  caregivers: Cuidador[];
  notifications: PreferenciasNotificacion;
}

export type Caregiver = Cuidador;
export type NotificationPreferences = PreferenciasNotificacion;
export type UserProfile = PerfilUsuario;
