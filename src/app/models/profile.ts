export interface Caregiver {
  id: string;
  name: string;
  role: string;
  phone: string;
  emoji: string;
}

export interface NotificationPreferences {
  medicationReminders: boolean;
  appointmentReminders: boolean;
  soundEnabled: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  email: string;
  avatarEmoji: string;
  emergencyPhone: string;
  caregivers: Caregiver[];
  notifications: NotificationPreferences;
}
