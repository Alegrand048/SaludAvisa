import { Calendar, Plus, MapPin, Clock, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useAppointmentsController } from "../controllers/useAppointmentsController";
import { useAuthSession } from "../context/AuthSessionContext";
import { familyGroupService } from "../services/familyGroupService";
import { AddAppointmentDialog } from "../components/AddAppointmentDialog";
import { EditAppointmentDialog } from "../components/EditAppointmentDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

function formatAppointmentDate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatAppointmentTime(dateTime: string): string {
  return new Date(dateTime).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function toLocalIsoDateTime(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute, 0);
  return localDate.toISOString();
}

export default function Appointments() {
  const navigate = useNavigate();
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const { appointments, count, isLoading, addAppointment, updateAppointment, removeAppointment } = useAppointmentsController();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { isCaregiverRole, user } = useAuthSession();

  const selectedAppointment = appointments.find((item) => item.id === selectedAppointmentId) ?? null;
  const editingAppointment = appointments.find((item) => item.id === editingAppointmentId) ?? null;

  useEffect(() => {
    const loadClientOptions = async () => {
      if (!isCaregiverRole || !user?.id || !user.email) {
        setClientOptions([]);
        return;
      }

      const group = await familyGroupService.getForUser(user.id, user.email);
      if (!group) {
        setClientOptions([]);
        return;
      }

      const emails = group.members
        .filter((member) => member.role === "cliente")
        .map((member) => member.email);
      setClientOptions(Array.from(new Set(emails)));
    };

    void loadClientOptions();
  }, [isCaregiverRole, user?.id, user?.email]);

  const handleSubmitNewAppointment = async (payload: {
    specialty: string;
    location: string;
    doctor: string;
    date: string;
    time: string;
    clientEmail?: string;
  }) => {
    if (!isCaregiverRole) {
      return;
    }

    await addAppointment(
      {
        specialty: payload.specialty,
        dateTime: toLocalIsoDateTime(payload.date, payload.time),
        location: payload.location,
        doctor: payload.doctor,
        emoji: "🩺",
        color: "from-green-100 to-green-50",
      },
      payload.clientEmail,
    );
  };

  const handleUpdateAppointment = async (payload: {
    specialty: string;
    location: string;
    doctor: string;
    date: string;
    time: string;
  }) => {
    if (!editingAppointmentId) {
      return;
    }

    await updateAppointment(editingAppointmentId, {
      specialty: payload.specialty,
      location: payload.location,
      doctor: payload.doctor,
      dateTime: toLocalIsoDateTime(payload.date, payload.time),
    });
    setEditingAppointmentId(null);
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      setDeleteError(null);
      await removeAppointment(id);
      setSelectedAppointmentId(null);
    } catch (error) {
      console.error("Error al eliminar cita:", error);
      const message = error instanceof Error ? error.message : "No se pudo borrar la cita.";
      setDeleteError(message);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-header-glass px-4 py-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="size-11 rounded-2xl border border-border/70 bg-card/90 flex items-center justify-center text-foreground"
              aria-label="Volver a inicio"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="size-11 rounded-2xl bg-primary/12 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Calendar className="size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">Mis Citas</h1>
                <p className="subtle-kicker mt-1">{count} citas programadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="app-main">
        {isLoading ? <Card className="app-page-card p-5 text-center text-sm text-muted-foreground">Cargando citas...</Card> : null}

        <Card className="app-page-card hero-gradient p-4 border-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agenda médica</p>
              <p className="text-sm font-semibold text-foreground">Consulta rápido tus próximas citas</p>
            </div>
            <span className="status-chip status-chip--muted">{count} total</span>
          </div>
        </Card>

        {appointments.map((apt) => (
          <Card
            key={apt.id}
            className={`app-page-card p-4 border-0 bg-gradient-to-br ${apt.color}`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 rounded-2xl bg-card/85 flex items-center justify-center shadow-sm shrink-0">
                    <span className="text-xl">{apt.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold tracking-tight text-foreground truncate">{apt.specialty}</h3>
                    <p className="text-sm text-muted-foreground truncate">{apt.doctor}</p>
                  </div>
                </div>
                <span className="status-chip status-chip--muted shrink-0">{formatAppointmentTime(apt.dateTime)}</span>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>{formatAppointmentDate(apt.dateTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span>{apt.location}</span>
                </div>
              </div>

              <Button
                size="lg"
                variant="outline"
                className="w-full h-10 text-sm font-semibold rounded-2xl border-border/70 bg-card/85"
                onClick={() => setSelectedAppointmentId(apt.id)}
              >
                Ver detalle
              </Button>

              {isCaregiverRole ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-2xl border border-border/70 bg-card/85 flex items-center justify-center gap-2 text-sm font-semibold text-foreground shadow-sm hover:bg-primary/10 transition-colors"
                    onClick={() => setEditingAppointmentId(apt.id)}
                  >
                    <Pencil className="size-4 text-primary" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-2xl border border-border/70 bg-card/85 flex items-center justify-center gap-2 text-sm font-semibold text-foreground shadow-sm hover:bg-destructive/10 transition-colors"
                    onClick={() => void handleDeleteAppointment(apt.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                    Borrar
                  </button>
                </div>
              ) : null}
            </div>
          </Card>
        ))}

        {appointments.length === 0 ? (
          <Card className="app-page-card p-7 text-center text-sm text-muted-foreground">No hay citas registradas.</Card>
        ) : null}

        <Card className="app-page-card p-4 border-0 bg-gradient-to-br from-yellow-100 to-yellow-50">
          <div className="flex items-center gap-4">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Recuerda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Lleva siempre tu DNI y tarjeta sanitaria a las citas
              </p>
            </div>
          </div>
        </Card>
      </div>

      {isCaregiverRole ? (
        <button
          className="fixed bottom-24 right-4 size-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg flex items-center justify-center z-20"
          onClick={() => {
            setIsAddDialogOpen(true);
          }}
          aria-label="Añadir cita"
        >
          <Plus className="size-7" strokeWidth={2.8} />
        </button>
      ) : null}

      <AddAppointmentDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        showClientAssignment={isCaregiverRole}
        clientOptions={clientOptions}
        onSubmit={handleSubmitNewAppointment}
      />

      <EditAppointmentDialog
        open={Boolean(editingAppointment)}
        onClose={() => setEditingAppointmentId(null)}
        appointment={editingAppointment ?? undefined}
        onSubmit={handleUpdateAppointment}
      />

      <Dialog open={Boolean(selectedAppointment)} onOpenChange={(nextOpen) => (!nextOpen ? setSelectedAppointmentId(null) : undefined)}>
        <DialogContent className="rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">Detalle de la cita</DialogTitle>
          </DialogHeader>

          {selectedAppointment ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Especialidad</p>
                <p className="mt-1 text-base font-semibold text-foreground">{selectedAppointment.specialty}</p>
                <p className="text-sm text-muted-foreground">{selectedAppointment.doctor}</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-background/80 p-3.5">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>{formatAppointmentDate(selectedAppointment.dateTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Clock className="size-4 text-muted-foreground" />
                  <span>{formatAppointmentTime(selectedAppointment.dateTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(selectedAppointment.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                    >
                      {selectedAppointment.location}
                    </a>
                  </span>
                </div>
              </div>

              {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

              {isCaregiverRole ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedAppointmentId(null);
                      setEditingAppointmentId(selectedAppointmentId);
                    }}
                    className="h-10 rounded-2xl"
                  >
                    <Pencil className="size-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteAppointment(selectedAppointmentId!)}
                    className="h-10 rounded-2xl"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Borrar
                  </Button>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">Guarda esta información para tenerla a mano antes de salir de casa.</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
