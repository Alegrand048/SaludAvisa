import { UserProfile } from "../models/profile";
import { readFromStorage, writeToStorage } from "./storage";

const STORAGE_KEY = "saludavisa.profile";

const seedProfile: UserProfile = {
  id: "user-1",
  name: "Maria Garcia",
  age: 78,
  email: "maria.garcia@email.com",
  avatarEmoji: "👵",
  emergencyPhone: "900 123 456",
  notifications: {
    medicationReminders: true,
    appointmentReminders: true,
    soundEnabled: true,
  },
  caregivers: [
    {
      id: "c1",
      name: "Carlos Garcia",
      role: "Hijo - Cuidador principal",
      phone: "600 111 222",
      emoji: "👨",
    },
    {
      id: "c2",
      name: "Ana Garcia",
      role: "Hija",
      phone: "600 333 444",
      emoji: "👩",
    },
  ],
};

function getStoredProfile(): UserProfile {
  return readFromStorage<UserProfile>(STORAGE_KEY, seedProfile);
}

function saveProfile(profile: UserProfile): void {
  writeToStorage(STORAGE_KEY, profile);
}

export const profileService = {
  get(): UserProfile {
    return getStoredProfile();
  },

  updateNotifications(profile: UserProfile["notifications"]): UserProfile {
    const updated = {
      ...getStoredProfile(),
      notifications: profile,
    };
    saveProfile(updated);
    return updated;
  },
};
