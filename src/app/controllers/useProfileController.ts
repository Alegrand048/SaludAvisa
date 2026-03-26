import { useState } from "react";
import { profileService } from "../services/profileService";

export function useProfileController() {
  const [profile, setProfile] = useState(() => profileService.get());

  const toggleMedicationReminders = (checked: boolean) => {
    setProfile(
      profileService.updateNotifications({
        ...profile.notifications,
        medicationReminders: checked,
      }),
    );
  };

  const toggleAppointmentReminders = (checked: boolean) => {
    setProfile(
      profileService.updateNotifications({
        ...profile.notifications,
        appointmentReminders: checked,
      }),
    );
  };

  const toggleSoundEnabled = (checked: boolean) => {
    setProfile(
      profileService.updateNotifications({
        ...profile.notifications,
        soundEnabled: checked,
      }),
    );
  };

  return {
    profile,
    toggleMedicationReminders,
    toggleAppointmentReminders,
    toggleSoundEnabled,
  };
}
