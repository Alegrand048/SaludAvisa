import { User, Bell, Users, LogOut, ChevronRight, Heart, Trash2, SlidersHorizontal, Camera } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BottomNav } from "../components/BottomNav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { appointmentService } from "../services/appointmentService";
import { medicationService, type MedicationTakenLog } from "../services/medicationService";
import { Appointment } from "../models/appointment";
import { useAuthController } from "../controllers/useAuthController";
import { useProfileController } from "../controllers/useProfileController";
import { useAuthSession } from "../context/AuthSessionContext";
import { familyGroupService, FamilyGroup, JoinRequest, MemberProfileSummary } from "../services/familyGroupService";
import { StylePreference, TextSizePreference, resolveStyleByRole, resolveTextSizeByRole, useStyleStore } from "../stores/useStyleStore";

function roleLabel(role: "usuario" | "familiar_cuidador"): string {
  return role === "familiar_cuidador" ? "Familiar/Cuidador" : "Cliente";
}

function usernameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) {
    return "Usuario";
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`)
    .join(" ");
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function isAlreadyUnlinkedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("no pertenezco") || message.includes("ningun grupo activo");
}

const CONTACT_PHONE = "644 47 28 38";

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

interface MonthlyDayRegistry {
  dateKey: string;
  appointments: Appointment[];
  medicationLogs: Array<MedicationTakenLog & { lateMinutes: number }>;
  missedCount: number;
}

function dateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameMonth(date: Date, monthDate: Date): boolean {
  return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
}

function weekdayCode(date: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] ?? "mon";
}

function isMedicationAllowedOnDate(medication: { daysOfWeek?: string[]; durationDays?: number; startDate?: string }, date: Date): boolean {
  if (medication.daysOfWeek && medication.daysOfWeek.length > 0 && !medication.daysOfWeek.includes(weekdayCode(date))) {
    return false;
  }

  if (medication.startDate && medication.durationDays && medication.durationDays > 0) {
    const start = new Date(`${medication.startDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + medication.durationDays - 1);
    end.setHours(23, 59, 59, 999);
    if (date < start || date > end) {
      return false;
    }
  }

  return true;
}

function estimateLateMinutes(takenAtIso: string, times: string[] | undefined): number {
  const takenDate = new Date(takenAtIso);
  if (!times || times.length === 0) {
    return 0;
  }

  const scheduleDates = times.map((time) => {
    const [hour, minute] = time.split(":").map(Number);
    const slot = new Date(takenDate);
    slot.setHours(hour, minute, 0, 0);
    return slot;
  });

  const closest = scheduleDates.reduce((best, slot) => {
    const bestDiff = Math.abs(takenDate.getTime() - best.getTime());
    const slotDiff = Math.abs(takenDate.getTime() - slot.getTime());
    return slotDiff < bestDiff ? slot : best;
  }, scheduleDates[0]);

  return Math.max(0, Math.round((takenDate.getTime() - closest.getTime()) / 60000));
}

export default function Profile() {
  const navigate = useNavigate();
  const { signOut, user, role } = useAuthSession();
  const baseStylePreference = useStyleStore((state) => state.baseStylePreference);
  const nightMode = useStyleStore((state) => state.nightMode);
  const textSizePreference = useStyleStore((state) => state.textSizePreference);
  const setBaseStylePreference = useStyleStore((state) => state.setBaseStylePreference);
  const setNightMode = useStyleStore((state) => state.setNightMode);
  const setTextSizePreference = useStyleStore((state) => state.setTextSizePreference);
  const { deleteAccount, verifyPassword, updateDisplayName, isLoading: authLoading } = useAuthController();
  const {
    profile,
    toggleMedicationReminders,
    toggleAppointmentReminders,
    toggleSoundEnabled,
    updateAppearance,
  } = useProfileController();

  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingFamilyGroup, setLoadingFamilyGroup] = useState(false);
  const [memberNamesByEmail, setMemberNamesByEmail] = useState<Record<string, string>>({});
  const [memberProfilesByEmail, setMemberProfilesByEmail] = useState<Record<string, MemberProfileSummary>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isConfirmPasswordOpen, setIsConfirmPasswordOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | undefined>(undefined);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<"emergency" | "support" | "about" | null>(null);
  const [isMonthlyRegistryOpen, setIsMonthlyRegistryOpen] = useState(false);
  const [monthlyRegistry, setMonthlyRegistry] = useState<MonthlyDayRegistry[]>([]);
  const [monthlyRegistryLoading, setMonthlyRegistryLoading] = useState(false);

  const isClientRole = role === "usuario";
  const isFamilyRole = role === "familiar_cuidador";

  const styleOptions: Array<{ value: StylePreference; label: string; description: string }> = [
    { value: "senior-clean", label: "Cliente limpio", description: "Mayor contraste y lectura grande" },
    { value: "care-modern", label: "Moderno cuidador", description: "Tarjetas modernas y enfoque productivo" },
  ];

  const textSizeOptions: Array<{ value: TextSizePreference; label: string; description: string }> = [
    { value: "normal", label: "Normal", description: "Tamaño estándar" },
    { value: "large", label: "Grande", description: "Más cómodo para lectura" },
  ];

  const effectiveStyle = resolveStyleByRole(role, baseStylePreference, nightMode);
  const effectiveTextSize = resolveTextSizeByRole(role, textSizePreference);

  useEffect(() => {
    setEditName(profile.name);
    setEditAvatarUrl(profile.avatarUrl);
  }, [profile.name, profile.avatarUrl]);

  const activeClientCount = useMemo(
    () => familyGroup?.members.filter((member) => member.role === "cliente").length ?? 0,
    [familyGroup],
  );

  const resolveMemberDisplayName = (email: string, memberRole: "cliente" | "familiar_cuidador"): string => {
    const normalizedMemberEmail = normalizeEmail(email);
    const normalizedProfileEmail = normalizeEmail(profile.email);
    const normalizedAuthEmail = normalizeEmail(user?.email);

    if (normalizedMemberEmail === normalizedProfileEmail || normalizedMemberEmail === normalizedAuthEmail) {
      return profile.name;
    }

    const mappedName = memberNamesByEmail[normalizedMemberEmail];
    if (mappedName?.trim()) {
      return mappedName;
    }

    return usernameFromEmail(email);
  };

  const reloadFamilyData = async () => {
    if (!user?.id || !user.email) {
      setFamilyGroup(null);
      setPendingJoinRequests([]);
      setMemberNamesByEmail({});
      setMemberProfilesByEmail({});
      return;
    }

    setLoadingFamilyGroup(true);
    try {
      const group = await familyGroupService.getForUser(user.id, user.email, role);
      setFamilyGroup(group);

      if (group) {
        const profileMap = await familyGroupService.getMemberProfiles(
          group.members.map((member) => member.email),
          user.email,
        );
        const nameMap = Object.fromEntries(
          Object.entries(profileMap)
            .filter(([, profileSummary]) => Boolean(profileSummary.name?.trim()))
            .map(([email, profileSummary]) => [email, profileSummary.name?.trim() ?? ""]),
        );
        
        setMemberNamesByEmail(nameMap);
        setMemberProfilesByEmail(profileMap);
      } else {
        setMemberNamesByEmail({});
        setMemberProfilesByEmail({});
      }

      if (isClientRole) {
        const requests = await familyGroupService.getPendingJoinRequestsForClient(user.email);
        setPendingJoinRequests(requests);
      } else {
        setPendingJoinRequests([]);
      }
    } finally {
      setLoadingFamilyGroup(false);
    }
  };

  useEffect(() => {
    void reloadFamilyData();
  }, [user?.id, user?.email, role]);

  useEffect(() => {
    if (baseStylePreference === "auto") {
      setBaseStylePreference(role === "usuario" ? "senior-clean" : "care-modern");
    }

    if (textSizePreference === "auto") {
      setTextSizePreference(role === "usuario" ? "large" : "normal");
    }
  }, [
    baseStylePreference,
    role,
    setBaseStylePreference,
    setTextSizePreference,
    textSizePreference,
  ]);

  const handleSendJoinRequest = async () => {
    if (!user?.id || !user.email) {
      return;
    }

    const clientEmail = window.prompt("Correo del cliente al que quieres unirte:");
    if (!clientEmail?.trim()) {
      return;
    }

    try {
      await familyGroupService.createJoinRequest(
        user.id,
        user.email,
        clientEmail.trim(),
        profile.name || "Familiar/Cuidador",
      );
      window.alert("Solicitud enviada. El cliente debe aceptarla en su perfil.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!user?.id || !user.email) {
      return;
    }

    try {
      await familyGroupService.acceptJoinRequest(user.id, user.email, requestId);
      await reloadFamilyData();
      window.alert("Solicitud aceptada. Ya estais conectados.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo aceptar la solicitud.");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user?.id || !user.email) {
      return;
    }

    try {
      await familyGroupService.rejectJoinRequest(user.id, user.email, requestId);
      await reloadFamilyData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo rechazar la solicitud.");
    }
  };

  const handleRemoveMember = async (memberEmail: string) => {
    if (!user?.id || !user.email) {
      return;
    }

    const confirmation = window.confirm(`Vas a desvincularte de ${memberEmail}.`);
    if (!confirmation) {
      return;
    }

    try {
      // For caregiver accounts this action should disconnect from the client,
      // not call owner-only member expulsion RPC.
      await familyGroupService.leaveGroup(user.id, user.email);
      await reloadFamilyData();
      window.alert("Te has desvinculado del cliente correctamente.");
    } catch (error) {
      if (isAlreadyUnlinkedError(error)) {
        setFamilyGroup(null);
        setMemberNamesByEmail({});
        setMemberProfilesByEmail({});
        setPendingJoinRequests([]);
        window.alert("Ya estabas desvinculado del cliente.");
        return;
      }

      window.alert(error instanceof Error ? error.message : "No se pudo completar la desvinculación.");
    }
  };

  const handleLeaveGroup = async () => {
    if (!user?.id || !user.email) {
      return;
    }

    const confirmation = window.confirm("Vas a salir del grupo familiar. Esta accion te desconectara del cliente.");
    if (!confirmation) {
      return;
    }

    try {
      await familyGroupService.leaveGroup(user.id, user.email);
      await reloadFamilyData();
      window.alert("Ya no formas parte del grupo familiar.");
    } catch (error) {
      if (isAlreadyUnlinkedError(error)) {
        setFamilyGroup(null);
        setMemberNamesByEmail({});
        setMemberProfilesByEmail({});
        setPendingJoinRequests([]);
        window.alert("Ya no formas parte de ningun grupo familiar.");
        return;
      }

      window.alert(error instanceof Error ? error.message : "No se pudo salir del grupo.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      // Keep UX reliable even if Supabase signOut fails transiently.
      console.error("Error al cerrar sesion:", error);
    } finally {
      navigate("/");
      window.location.assign("/");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm(
      "Esta accion eliminara tu cuenta y tus datos. Esta seguro de continuar?",
    );
    if (!confirmation) {
      return;
    }

    const password = window.prompt("Escribe tu contrasena para confirmar el borrado:");
    if (!password?.trim()) {
      return;
    }

    const result = await deleteAccount(password.trim());
    if (result.ok) {
      window.alert("Cuenta eliminada correctamente.");
      navigate("/");
      return;
    }

    window.alert(result.errorMessage ?? "No se pudo eliminar la cuenta. Revisa la configuracion de Supabase.");
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setEditError("Selecciona una imagen válida.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfileAppearance = async () => {
    setEditError(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("El nombre no puede estar vacío.");
      return;
    }

    if (!confirmPassword.trim()) {
      setEditError("Introduce tu contrasena para confirmar cambios.");
      return;
    }

    const nameChanged = trimmedName !== profile.name;

    if (nameChanged) {
      const nameResult = await updateDisplayName(confirmPassword.trim(), trimmedName);
      if (!nameResult.ok) {
        setEditError(nameResult.errorMessage ?? "No se pudo actualizar el nombre.");
        return;
      }
    } else {
      const verifyResult = await verifyPassword(confirmPassword.trim());
      if (!verifyResult.ok) {
        setEditError(verifyResult.errorMessage ?? "Contrasena incorrecta.");
        return;
      }
    }

    try {
      await updateAppearance(trimmedName, editAvatarUrl);
      setConfirmPassword("");
      setIsConfirmPasswordOpen(false);
      setIsEditProfileOpen(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar la foto de perfil.");
    }
  };

  useEffect(() => {
    if (!isMonthlyRegistryOpen) {
      return;
    }

    let mounted = true;

    const loadMonthlyRegistry = async () => {
      setMonthlyRegistryLoading(true);
      try {
        const monthDate = new Date();
        const [appointments, medications, takenLogs] = await Promise.all([
          appointmentService.getAllAsync(),
          medicationService.getAllAsync(),
          medicationService.getTakenLogsForMonthAsync(monthDate.getFullYear(), monthDate.getMonth()),
        ]);

        if (!mounted) {
          return;
        }

        const medicationById = new Map(
          medications.map((medication) => [medication.id.replace(/^shared-/, ""), medication]),
        );

        const logsWithLate = takenLogs.map((log) => {
          const medication = medicationById.get(log.medicationId);
          return {
            ...log,
            lateMinutes: estimateLateMinutes(log.takenAt, medication?.times),
          };
        });

        const dayMap = new Map<string, MonthlyDayRegistry>();

        for (const appointment of appointments) {
          const appointmentDate = new Date(appointment.dateTime);
          if (!isSameMonth(appointmentDate, monthDate)) {
            continue;
          }

          const key = dateKeyFromDate(appointmentDate);
          const current = dayMap.get(key) ?? { dateKey: key, appointments: [], medicationLogs: [], missedCount: 0 };
          current.appointments.push(appointment);
          dayMap.set(key, current);
        }

        for (const log of logsWithLate) {
          const key = dateKeyFromDate(new Date(log.takenAt));
          const current = dayMap.get(key) ?? { dateKey: key, appointments: [], medicationLogs: [], missedCount: 0 };
          current.medicationLogs.push(log);
          dayMap.set(key, current);
        }

        const now = new Date();
        const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

        for (let cursor = new Date(firstDay); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
          const day = new Date(cursor);
          if (day > now) {
            break;
          }

          const key = dateKeyFromDate(day);
          const current = dayMap.get(key) ?? { dateKey: key, appointments: [], medicationLogs: [], missedCount: 0 };

          const logsForDayByMed = current.medicationLogs.reduce<Record<string, number>>((acc, log) => {
            const baseId = log.medicationId.replace(/^shared-/, "");
            const validTaken = log.lateMinutes < 60 ? 1 : 0;
            acc[baseId] = (acc[baseId] ?? 0) + validTaken;
            return acc;
          }, {});

          let missed = 0;
          for (const medication of medications) {
            if (!medication.active || !isMedicationAllowedOnDate(medication, day)) {
              continue;
            }

            const baseId = medication.id.replace(/^shared-/, "");
            const scheduled = medication.times.length;
            const takenValid = logsForDayByMed[baseId] ?? 0;
            const lateTooMuch = current.medicationLogs.filter((log) => log.medicationId.replace(/^shared-/, "") === baseId && log.lateMinutes >= 60).length;
            missed += Math.max(0, scheduled - takenValid) + lateTooMuch;
          }

          current.missedCount = missed;
          current.medicationLogs.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
          current.appointments.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
          dayMap.set(key, current);
        }

        const ordered = Array.from(dayMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        setMonthlyRegistry(ordered);
      } finally {
        if (mounted) {
          setMonthlyRegistryLoading(false);
        }
      }
    };

    void loadMonthlyRegistry();

    return () => {
      mounted = false;
    };
  }, [isMonthlyRegistryOpen]);

  return (
    <div className="app-shell">
      <div className="app-header-glass px-4 py-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/12 border border-primary/20 text-primary flex items-center justify-center overflow-hidden">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <User className="size-6" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi Perfil</h1>
              <p className="subtle-kicker mt-1">Configuración y ajustes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="app-main">
        <Card className="app-page-card hero-gradient p-4 border-0">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-card/85 flex items-center justify-center shadow-sm shrink-0 overflow-hidden border border-border/60">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-foreground">{initialsFromName(profile.name)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{roleLabel(profile.role)}</p>
              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsEditProfileOpen(true)}>
              <Camera className="size-4 mr-1.5" />
              Editar
            </Button>
          </div>
        </Card>

        <Card className="app-page-card p-4 space-y-4 border-0">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Grupo familiar
          </h3>

          {loadingFamilyGroup ? <p className="text-sm text-muted-foreground">Cargando grupo familiar...</p> : null}

          {!loadingFamilyGroup && familyGroup ? (
            <>
              <p className="text-sm text-foreground">
                Familia activa. Clientes en familia: {activeClientCount}/2
              </p>
              <ul className="space-y-2 text-sm text-foreground">
                {familyGroup.members.map((member) => {
                  const memberName = resolveMemberDisplayName(member.email, member.role);
                  const memberIsCurrentUser = normalizeEmail(member.email) === normalizeEmail(user?.email) || normalizeEmail(member.email) === normalizeEmail(profile.email);
                  const memberAvatar = memberIsCurrentUser
                    ? profile.avatarUrl
                    : memberProfilesByEmail[normalizeEmail(member.email)]?.avatarUrl;

                  return (
                    <li key={member.email} className="rounded-xl bg-background/80 p-2.5 border border-border/70 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-9 rounded-full bg-secondary border border-border/70 overflow-hidden flex items-center justify-center shrink-0">
                          {memberAvatar ? (
                            <img src={memberAvatar} alt={`Foto de ${memberName}`} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-foreground">{initialsFromName(memberName)}</span>
                          )}
                        </div>
                        <span className="truncate font-medium">{memberName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary border border-border/70">
                          {member.role === "cliente" ? "Cliente" : "Familiar/Cuidador"}
                        </span>
                        {isFamilyRole && member.role === "cliente" && member.email !== user?.email ? (
                          <Button size="sm" variant="outline" onClick={() => void handleRemoveMember(member.email)}>
                            Quitar
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {!loadingFamilyGroup && !familyGroup ? (
            <p className="text-sm text-muted-foreground">
              {isFamilyRole
                ? "No estas conectado a ningun cliente."
                : "No tienes conexiones familiares activas."}
            </p>
          ) : null}

          {isFamilyRole ? (
            <Button size="lg" variant="outline" className="w-full" onClick={() => void handleSendJoinRequest()}>
              Solicitar unirme a un cliente
            </Button>
          ) : null}

          {isClientRole && familyGroup && familyGroup.members.some((member) => member.email === user?.email) ? (
            <Button size="lg" variant="destructive" className="w-full" onClick={() => void handleLeaveGroup()}>
              Salir del grupo familiar
            </Button>
          ) : null}

          {isClientRole ? (
            <>
              <p className="text-sm font-semibold text-foreground">Solicitudes pendientes</p>
              {pendingJoinRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
              ) : (
                <div className="space-y-2">
                  {pendingJoinRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-border/70 bg-background/80 p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">{request.requesterName}</p>
                      <p className="text-xs text-muted-foreground">{request.requesterEmail}</p>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => void handleAcceptRequest(request.id)}>
                          Aceptar
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => void handleRejectRequest(request.id)}>
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          <Button size="lg" variant="outline" className="w-full" onClick={() => void reloadFamilyData()}>
            Refrescar grupo
          </Button>
        </Card>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            Notificaciones
          </h3>

          <Card className="app-page-card p-4 space-y-4 border-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-2xl">💊</span>
                <div>
                  <p className="text-base font-semibold text-foreground">Recordatorios de medicación</p>
                  <p className="text-sm text-muted-foreground">Avisos para tomar tu medicación</p>
                </div>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={profile.notifications.medicationReminders}
                  onCheckedChange={toggleMedicationReminders}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Recordatorios de citas</p>
                    <p className="text-sm text-muted-foreground">Avisos de citas médicas</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Switch
                    checked={profile.notifications.appointmentReminders}
                    onCheckedChange={toggleAppointmentReminders}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Sonido de alertas</p>
                    <p className="text-sm text-muted-foreground">Activar sonido en recordatorios</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Switch
                    checked={profile.notifications.soundEnabled}
                    onCheckedChange={toggleSoundEnabled}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="app-page-card divide-y border-0">
          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => setInfoDialog("emergency")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <span className="text-base font-semibold text-foreground">Contacto de emergencia</span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => setIsSettingsOpen(true)}
          >
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="size-5 text-primary" />
              <div>
                <p className="text-base font-semibold text-foreground text-left">Ajustes</p>
                <p className="text-xs text-muted-foreground text-left">
                  {effectiveStyle === "senior-night" ? "Cliente limpio (noche)" : effectiveStyle === "care-night" ? "Moderno cuidador (noche)" : effectiveStyle === "senior-clean" ? "Cliente limpio" : "Moderno cuidador"} · Tamaño {effectiveTextSize === "large" ? "grande" : "normal"}
                </p>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          {isFamilyRole ? (
            <button
              className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
              onClick={() => setIsMonthlyRegistryOpen(true)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🗓️</span>
                <span className="text-base font-semibold text-foreground">Registro mensual</span>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ) : null}

          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => setInfoDialog("support")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">❓</span>
              <span className="text-base font-semibold text-foreground">Ayuda y soporte</span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => setInfoDialog("about")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">ℹ️</span>
              <span className="text-base font-semibold text-foreground">Acerca de SaludAvisa</span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        </Card>

        <Button
          onClick={() => {
            void handleSignOut();
          }}
          size="lg"
          variant="outline"
          className="w-full h-12 text-base font-semibold border border-destructive/35 text-destructive hover:bg-destructive/10 rounded-2xl"
        >
          <LogOut className="size-5 mr-2" />
          Cerrar sesión
        </Button>

        <Button
          onClick={() => {
            void handleDeleteAccount();
          }}
          disabled={authLoading}
          size="lg"
          variant="outline"
          className="w-full h-12 text-base font-semibold border border-destructive/55 text-destructive hover:bg-destructive/15 rounded-2xl"
        >
          <Trash2 className="size-5 mr-2" />
          {authLoading ? "Eliminando cuenta..." : "Borrar cuenta"}
        </Button>

        <Card className="app-page-card p-4 border-0">
          <div className="flex flex-col items-center gap-3 text-center">
            <Heart className="size-7 text-primary" fill="currentColor" />
            <p className="text-base text-foreground">
              <strong>SaludAvisa</strong> está aquí para cuidarte
            </p>
            <p className="text-sm text-muted-foreground">
              Si necesitas ayuda, llama al <strong>{CONTACT_PHONE}</strong>
            </p>
          </div>
        </Card>
      </div>

      <BottomNav />

      <Dialog
        open={isEditProfileOpen}
        onOpenChange={(open) => {
          setIsEditProfileOpen(open);
          if (!open) {
            setEditError(null);
            setEditName(profile.name);
            setEditAvatarUrl(profile.avatarUrl);
          }
        }}
      >
        <DialogContent className="rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Editar perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-16 rounded-2xl bg-secondary border border-border/70 overflow-hidden flex items-center justify-center">
                {editAvatarUrl ? (
                  <img src={editAvatarUrl} alt="Vista previa de perfil" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-foreground">{initialsFromName(editName || profile.name)}</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="profile-avatar-upload">
                  Cambiar foto
                </label>
                <Input id="profile-avatar-upload" type="file" accept="image/*" onChange={(event) => void handleAvatarFileChange(event)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="profile-name-input">
                Nombre visible
              </label>
              <Input
                id="profile-name-input"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Tu nombre"
              />
            </div>

            <p className="text-xs text-muted-foreground">Se pedirá tu contrasena al guardar.</p>

            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => setIsEditProfileOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditError(null);
                  setConfirmPassword("");
                  setIsConfirmPasswordOpen(true);
                }}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isConfirmPasswordOpen}
        onOpenChange={(open) => {
          setIsConfirmPasswordOpen(open);
          if (!open) {
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent className="rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Confirmar cambios</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para guardar cambios en tu perfil, introduce tu contrasena.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="confirm-password-input">
                Contrasena
              </label>
              <Input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Tu contrasena"
              />
            </div>

            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => setIsConfirmPasswordOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSaveProfileAppearance()}>
                Confirmar y guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Ajustes de apariencia</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {styleOptions.map((option) => {
              const selected = baseStylePreference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBaseStylePreference(option.value)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/8" : "border-border/70 bg-background/80 hover:bg-secondary/50"}`}
                >
                  <p className="text-base font-semibold text-foreground">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 p-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">Modo noche</p>
                <p className="text-sm text-muted-foreground">Mejor para uso nocturno y menos fatiga visual</p>
              </div>
              <div className="shrink-0">
                <Switch checked={nightMode} onCheckedChange={setNightMode} aria-label="Activar modo noche" />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-3 space-y-2">
              <p className="text-base font-semibold text-foreground">Tamaño de texto</p>
              <p className="text-sm text-muted-foreground">Puedes personalizarlo desde aquí</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {textSizeOptions.map((option) => {
                  const selected = textSizePreference === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTextSizePreference(option.value)}
                      className={`rounded-2xl border p-2.5 text-left transition-colors ${selected ? "border-primary bg-primary/8" : "border-border/70 bg-background/80 hover:bg-secondary/50"}`}
                    >
                      <p className="text-sm font-semibold text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button type="button" className="w-full" onClick={() => setIsSettingsOpen(false)}>
              Cerrar ajustes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(infoDialog)} onOpenChange={(nextOpen) => (!nextOpen ? setInfoDialog(null) : undefined)}>
        <DialogContent className="rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {infoDialog === "emergency"
                ? "Contacto de emergencia"
                : infoDialog === "support"
                  ? "Ayuda y soporte"
                  : "Acerca de SaludAvisa"}
            </DialogTitle>
          </DialogHeader>

          {infoDialog === "emergency" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Usa este número cuando necesites ayuda inmediata o para avisar a tu contacto principal.
              </p>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Número de emergencia</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{CONTACT_PHONE}</p>
              </div>
            </div>
          ) : null}

          {infoDialog === "support" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Si tienes dudas con recordatorios, medicación o citas, puedes contactar con soporte en este horario.
              </p>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 space-y-1">
                <p className="text-sm font-semibold text-foreground">Canal de ayuda</p>
                <p className="text-sm text-muted-foreground">Teléfono: {CONTACT_PHONE}</p>
                <p className="text-sm text-muted-foreground">Horario: Lunes a Viernes, 9:00 - 18:00</p>
              </div>
            </div>
          ) : null}

          {infoDialog === "about" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                SaludAvisa ayuda a organizar tratamientos y citas médicas de forma sencilla.
              </p>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 space-y-1">
                <p className="text-sm text-foreground">
                  La app permite registrar medicación, marcar tomas diarias, controlar stock y consultar próximas citas.
                </p>
                <p className="text-sm text-foreground">
                  También facilita la colaboración entre cliente y cuidador para mejorar el seguimiento y reducir olvidos.
                </p>
              </div>
            </div>
          ) : null}

          <Button type="button" className="w-full mt-2" onClick={() => setInfoDialog(null)}>
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isMonthlyRegistryOpen} onOpenChange={setIsMonthlyRegistryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Registro del mes</DialogTitle>
          </DialogHeader>

          {monthlyRegistryLoading ? <p className="text-sm text-muted-foreground">Cargando registro...</p> : null}

          {!monthlyRegistryLoading && monthlyRegistry.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay actividad registrada este mes.</p>
          ) : null}

          <div className="space-y-3">
            {monthlyRegistry.map((day) => (
              <Card key={day.dateKey} className="app-page-card p-3 border-0">
                <p className="text-sm font-semibold text-foreground">{new Date(`${day.dateKey}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "2-digit" })}</p>
                {day.missedCount > 0 ? (
                  <p className="text-xs text-destructive mt-1">No tomadas estimadas: {day.missedCount}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Sin no tomadas estimadas</p>
                )}

                {day.medicationLogs.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Medicaciones</p>
                    {day.medicationLogs.map((log) => (
                      <p key={`${log.medicationId}-${log.takenAt}`} className="text-sm text-foreground">
                        {new Date(log.takenAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false })} · {log.medicationName}
                        {log.lateMinutes > 0 ? ` · tomado tarde (${log.lateMinutes} min)` : " · tomado en hora"}
                        {log.lateMinutes >= 60 ? " · cuenta como no tomado" : ""}
                      </p>
                    ))}
                  </div>
                ) : null}

                {day.appointments.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Citas</p>
                    {day.appointments.map((appointment) => (
                      <p key={appointment.id} className="text-sm text-foreground">
                        {new Date(appointment.dateTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false })} · {appointment.specialty} · {appointment.location}
                      </p>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>

          <Button type="button" className="w-full mt-2" onClick={() => setIsMonthlyRegistryOpen(false)}>
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
