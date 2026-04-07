import { User, Bell, Users, LogOut, ChevronRight, Heart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BottomNav } from "../components/BottomNav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { useAuthController } from "../controllers/useAuthController";
import { useProfileController } from "../controllers/useProfileController";
import { useAuthSession } from "../context/AuthSessionContext";
import { familyGroupService, FamilyGroup, JoinRequest } from "../services/familyGroupService";
import { StylePreference, resolveStyleByRole, useStyleStore } from "../stores/useStyleStore";

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

export default function Profile() {
  const navigate = useNavigate();
  const { signOut, user, role } = useAuthSession();
  const baseStylePreference = useStyleStore((state) => state.baseStylePreference);
  const nightMode = useStyleStore((state) => state.nightMode);
  const setBaseStylePreference = useStyleStore((state) => state.setBaseStylePreference);
  const setNightMode = useStyleStore((state) => state.setNightMode);
  const { deleteAccount, isLoading: authLoading } = useAuthController();
  const {
    profile,
    toggleMedicationReminders,
    toggleAppointmentReminders,
    toggleSoundEnabled,
  } = useProfileController();

  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingFamilyGroup, setLoadingFamilyGroup] = useState(false);
  const [memberNamesByEmail, setMemberNamesByEmail] = useState<Record<string, string>>({});

  const isClientRole = role === "usuario";
  const isFamilyRole = role === "familiar_cuidador";

  const styleOptions: Array<{ value: StylePreference; label: string; description: string }> = [
    { value: "auto", label: "Automatico", description: "Cliente: limpio / Cuidador: moderno" },
    { value: "senior-clean", label: "Cliente limpio", description: "Mayor contraste y lectura grande" },
    { value: "care-modern", label: "Moderno cuidador", description: "Tarjetas modernas y enfoque productivo" },
  ];

  const effectiveStyle = resolveStyleByRole(role, baseStylePreference, nightMode);

  const activeClientCount = useMemo(
    () => familyGroup?.members.filter((member) => member.role === "cliente").length ?? 0,
    [familyGroup],
  );

  const resolveMemberDisplayName = (email: string): string => {
    const normalizedMemberEmail = normalizeEmail(email);
    const normalizedProfileEmail = normalizeEmail(profile.email);
    const normalizedAuthEmail = normalizeEmail(user?.email);

    const mappedName = memberNamesByEmail[normalizedMemberEmail];
    if (mappedName?.trim()) {
      return mappedName;
    }

    if (normalizedMemberEmail === normalizedProfileEmail || normalizedMemberEmail === normalizedAuthEmail) {
      return profile.name;
    }

    return usernameFromEmail(email);
  };

  const reloadFamilyData = async () => {
    if (!user?.id || !user.email) {
      setFamilyGroup(null);
      setPendingJoinRequests([]);
      setMemberNamesByEmail({});
      return;
    }

    setLoadingFamilyGroup(true);
    try {
      const group = await familyGroupService.getForUser(user.id, user.email);
      setFamilyGroup(group);

      if (group) {
        const nameMap = await familyGroupService.getMemberDisplayNames(
          group.members.map((member) => member.email),
          user.email,
        );
        setMemberNamesByEmail(nameMap);
      } else {
        setMemberNamesByEmail({});
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

    const confirmation = window.confirm(`Vas a sacar a ${memberEmail} del grupo familiar.`);
    if (!confirmation) {
      return;
    }

    try {
      const password = window.prompt("Escribe la contrasena familiar para confirmar:");
      if (!password?.trim()) {
        return;
      }
      await familyGroupService.removeMember(user.id, memberEmail, password.trim());
      await reloadFamilyData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo sacar al miembro.");
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
      window.alert(error instanceof Error ? error.message : "No se pudo salir del grupo.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
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

  return (
    <div className="app-shell">
      <div className="app-header-glass px-4 py-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/12 border border-primary/20 text-primary flex items-center justify-center">
              <User className="size-6" />
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
            <div className="size-16 rounded-2xl bg-card/85 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-3xl">{profile.avatarEmoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{roleLabel(profile.role)}</p>
              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
            </div>
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
                Grupo activo. Clientes visibles: {activeClientCount}/2
              </p>
              <ul className="space-y-2 text-sm text-foreground">
                {familyGroup.members.map((member) => (
                  <li key={member.email} className="rounded-xl bg-background/80 p-2.5 border border-border/70 flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{resolveMemberDisplayName(member.email)}</span>
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
                ))}
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
          <h3 className="text-lg font-semibold text-foreground">Estilo visual</h3>
          <Card className="app-page-card p-4 space-y-3 border-0">
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

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-3">
              <div>
                <p className="text-base font-semibold text-foreground">Modo noche</p>
                <p className="text-sm text-muted-foreground">Mejor para uso nocturno y menos fatiga visual</p>
              </div>
              <Switch checked={nightMode} onCheckedChange={setNightMode} aria-label="Activar modo noche" />
            </div>

            <p className="text-sm text-muted-foreground">
              Estilo activo: <span className="font-semibold text-foreground">{effectiveStyle === "senior-night" ? "Cliente limpio (noche)" : effectiveStyle === "care-night" ? "Moderno cuidador (noche)" : effectiveStyle === "senior-clean" ? "Cliente limpio" : "Moderno cuidador"}</span>
            </p>
          </Card>

          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            Notificaciones
          </h3>

          <Card className="app-page-card p-4 space-y-4 border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">💊</span>
                <div>
                  <p className="text-base font-semibold text-foreground">Recordatorios de medicación</p>
                  <p className="text-sm text-muted-foreground">Avisos para tomar tu medicación</p>
                </div>
              </div>
              <Switch
                checked={profile.notifications.medicationReminders}
                onCheckedChange={toggleMedicationReminders}
                className="scale-125"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Recordatorios de citas</p>
                    <p className="text-sm text-muted-foreground">Avisos de citas médicas</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notifications.appointmentReminders}
                  onCheckedChange={toggleAppointmentReminders}
                  className="scale-125"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Sonido de alertas</p>
                    <p className="text-sm text-muted-foreground">Activar sonido en recordatorios</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notifications.soundEnabled}
                  onCheckedChange={toggleSoundEnabled}
                  className="scale-125"
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="app-page-card divide-y border-0">
          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => window.alert(`Contacto de emergencia: ${profile.emergencyPhone}`)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <span className="text-base font-semibold text-foreground">Contacto de emergencia</span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => window.alert("Soporte: 900 123 456")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">❓</span>
              <span className="text-base font-semibold text-foreground">Ayuda y soporte</span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          <button
            className="flex items-center justify-between p-4 w-full hover:bg-secondary/50 transition-colors"
            onClick={() => window.alert("SaludAvisa v1.0")}
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
          className="w-full h-12 text-base font-semibold border border-red-300 text-red-600 hover:bg-red-50 rounded-2xl"
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
          className="w-full h-12 text-base font-semibold border border-red-500 text-red-700 hover:bg-red-100 rounded-2xl"
        >
          <Trash2 className="size-5 mr-2" />
          {authLoading ? "Eliminando cuenta..." : "Borrar cuenta"}
        </Button>

        <Card className="app-page-card p-4 border-0 bg-gradient-to-br from-blue-100 to-blue-50">
          <div className="flex flex-col items-center gap-3 text-center">
            <Heart className="size-7 text-primary" fill="currentColor" />
            <p className="text-base text-foreground">
              <strong>SaludAvisa</strong> está aquí para cuidarte
            </p>
            <p className="text-sm text-muted-foreground">
              Si necesitas ayuda, llama al <strong>{profile.emergencyPhone}</strong>
            </p>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
