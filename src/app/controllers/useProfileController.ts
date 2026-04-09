import { useEffect, useState } from "react";
import { profileService } from "../services/profileService";
import { useAuthSession } from "../context/AuthSessionContext";
import { UserProfile } from "../models/profile";

function baseFromAuth(
  userId: string,
  displayName: string,
  email: string,
  role: UserProfile["role"],
): Pick<UserProfile, "id" | "name" | "email" | "role" | "age"> {
  return {
    id: userId,
    name: displayName,
    email,
    role,
    age: 0,
  };
}

export function useControladorPerfil() {
  const { user, displayName, role } = useAuthSession();
  const usuario = baseFromAuth(user?.id ?? "anon", displayName || "Usuario", user?.email ?? "", role);
  const [profile, setProfile] = useState(() => profileService.get(usuario));

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      const loaded = await profileService.getAsync(usuario);
      if (mounted) {
        setProfile(loaded);
      }
    };
    void loadProfile();
    return () => {
      mounted = false;
    };
  }, [usuario.id, usuario.name, usuario.email, usuario.role]);

  const recargarPerfil = () => {
    setProfile(profileService.get(usuario));
  };

  const alternarRecordatoriosMedicacion = (checked: boolean) => {
    setProfile(
      profileService.updateNotifications(usuario, {
        ...profile.notifications,
        medicationReminders: checked,
      }),
    );
  };

  const alternarRecordatoriosCitas = (checked: boolean) => {
    setProfile(
      profileService.updateNotifications(usuario, {
        ...profile.notifications,
        appointmentReminders: checked,
      }),
    );
  };

  const alternarSonido = (checked: boolean) => {
    setProfile(
      profileService.updateNotifications(usuario, {
        ...profile.notifications,
        soundEnabled: checked,
      }),
    );
  };

  const addCaregiver = (name: string, caregiverRole: string, phone: string) => {
    setProfile(
      profileService.addCaregiver(usuario, {
        name,
        role: caregiverRole,
        phone,
      }),
    );
  };

  const updateAppearance = async (name: string, avatarUrl?: string) => {
    const optimistic = profileService.updateAppearance(usuario, {
      name,
      avatarUrl,
    });
    setProfile(optimistic);

    const synced = await profileService.updateAppearanceAsync(usuario, {
      name,
      avatarUrl,
    });
    setProfile(synced);
  };

  return {
    profile,
    toggleMedicationReminders: alternarRecordatoriosMedicacion,
    toggleAppointmentReminders: alternarRecordatoriosCitas,
    toggleSoundEnabled: alternarSonido,
    addCaregiver,
    updateAppearance,
    refreshProfile: recargarPerfil,
  };
}

export const useProfileController = useControladorPerfil;
