import { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Clock, ArrowLeft, Pencil } from "lucide-react";
import { Card } from "../components/ui/card";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useMedicationsController } from "../controllers/useMedicationsController";
import { AddMedicationDialog } from "../components/AddMedicationDialog";
import { useAuthSession } from "../context/AuthSessionContext";
import { familyGroupService } from "../services/familyGroupService";

function formatTimeTo12h(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

function formatScheduleDays(days: string[] | undefined): string {
  if (!days || days.length === 0) {
    return "Todos los días";
  }

  return days.map((day) => WEEKDAY_LABELS[day] ?? day).join(", ");
}

function formatLastTaken(lastTakenAt: string | undefined): string {
  if (!lastTakenAt) {
    return "Sin tomas registradas";
  }

  return new Date(lastTakenAt).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    if (date < start || date > end) {
      return false;
    }
  }

  return true;
}

function getScheduledDoseCountForDate(medication: { times: string[]; daysOfWeek?: string[]; durationDays?: number; startDate?: string }, date: Date): number {
  return isMedicationAllowedOnDate(medication, date) ? medication.times.length : 0;
}

function normalizeMedicationKey(id: string): string {
  return id.startsWith("shared-") ? id.replace("shared-", "") : id;
}

type MedicationFilter = "all" | "today" | "tomorrow" | "week";

const FILTER_LABELS: Record<MedicationFilter, string> = {
  all: "Todas",
  today: "Hoy",
  tomorrow: "Mañana",
  week: "Esta semana",
};

export default function Medications() {
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [pendingMedicationId, setPendingMedicationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MedicationFilter>("all");
  const { medications, count, isLoading, markAsTaken, addMedication, editMedication, removeMedication, todayTakenCountMap } = useMedicationsController();
  const { isCaregiverRole, user } = useAuthSession();

  const visibleMedications = useMemo(() => {
    const now = new Date();

    const matchesFilter = (medication: typeof medications[number]) => {
      if (selectedFilter === "all") {
        return true;
      }

      if (selectedFilter === "today" || selectedFilter === "tomorrow") {
        const date = new Date(now);
        date.setDate(date.getDate() + (selectedFilter === "today" ? 0 : 1));
        return getScheduledDoseCountForDate(medication, date) > 0;
      }

      for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(now);
        date.setDate(date.getDate() + offset);
        if (getScheduledDoseCountForDate(medication, date) > 0) {
          return true;
        }
      }

      return false;
    };

    return medications.filter(matchesFilter);
  }, [medications, selectedFilter]);

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

  const handleSubmitMedication = async (payload: {
    name: string;
    dosage: string;
    stock: number;
    boxType: string;
    times: string[];
    frequencyLabel: string;
    daysOfWeek: string[];
    durationDays: number;
    clientEmail?: string;
  }) => {
    const medicationPayload = {
      name: payload.name,
      dosage: payload.dosage,
      stock: payload.stock,
      boxType: payload.boxType,
      times: payload.times,
      daysOfWeek: payload.daysOfWeek,
      durationDays: payload.durationDays,
      startDate: new Date().toISOString().slice(0, 10),
      frequencyLabel: payload.frequencyLabel,
      color: "from-blue-100 to-blue-50",
      emoji: "💊",
      active: true,
    };

    if (editingMedicationId) {
      await editMedication(editingMedicationId, medicationPayload, payload.clientEmail);
      setEditingMedicationId(null);
      return;
    }

    await addMedication(medicationPayload, payload.clientEmail);
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
                <Pill className="size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">Mi Medicación</h1>
                <p className="subtle-kicker mt-1">{count} medicamentos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="app-main">
        {isLoading ? <Card className="app-page-card p-5 text-center text-sm text-muted-foreground">Cargando medicación...</Card> : null}

        {!isLoading ? (
          <Card className="app-page-card p-3.5 border-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Seguimiento</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isCaregiverRole ? "Gestiona y actualiza pautas" : "Marca solo las tomas pendientes"}
                  </p>
                </div>
                <div className="status-chip status-chip--positive shrink-0">
                  {isCaregiverRole ? "Gestión activa" : "Tratamiento activo"}
                </div>
              </div>
          </Card>
        ) : null}

        <Card className="app-page-card p-3.5 border-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vista rápida</p>
              <p className="text-sm font-semibold text-foreground">Filtra por día y marca solo lo pendiente</p>
            </div>
            <div className="status-chip status-chip--muted">
              {FILTER_LABELS[selectedFilter]}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FILTER_LABELS) as MedicationFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={`rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${selectedFilter === filter ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-foreground border border-border/70"}`}
            >
              {FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

        {visibleMedications.map((med) => {
          const scheduledToday = getScheduledDoseCountForDate(med, new Date());
          const takenToday = todayTakenCountMap[normalizeMedicationKey(med.id)] ?? 0;
          const objectiveCompletedToday = scheduledToday > 0 && takenToday >= scheduledToday;
          const statusLabel = objectiveCompletedToday
            ? "Objetivo de hoy completado"
            : scheduledToday > 0
              ? `${scheduledToday - takenToday} toma(s) pendiente(s) hoy`
              : "No toca hoy";

          return (
          <Card key={med.id} className={`app-page-card p-3.5 border-0 bg-gradient-to-br ${med.color} transition-shadow`}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-card/85 flex items-center justify-center shadow-sm shrink-0">
                  <span className="text-2xl">{med.emoji}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground truncate">{med.name}</h3>
                  <p className="text-sm text-muted-foreground">{med.dosage}</p>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Clock className="size-4" />
                  <span>Horario</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{med.times.map(formatTimeTo12h).join(" y ")}</p>
                <p className="text-xs text-muted-foreground">{med.frequencyLabel}</p>
                <p className="text-xs text-muted-foreground pt-0.5">
                  Días: {formatScheduleDays(med.daysOfWeek)} · Duración: {med.durationDays ? `${med.durationDays} días` : "sin definir"}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="status-chip status-chip--muted">Stock: {med.stock}</span>
                </div>
              </div>

              <p className="text-xs font-semibold text-primary">{statusLabel}</p>

              {!isCaregiverRole ? (
                <button
                  type="button"
                  className="w-full h-11 rounded-2xl border border-border/70 bg-card/85 text-sm font-semibold text-foreground shadow-sm disabled:opacity-60"
                  disabled={pendingMedicationId === med.id || objectiveCompletedToday || scheduledToday === 0}
                  onClick={async () => {
                    try {
                      setPendingMedicationId(med.id);
                      setActionError(null);
                      await markAsTaken(med.id);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "No se pudo marcar como tomado.";
                      setActionError(message);
                    } finally {
                      setPendingMedicationId(null);
                    }
                  }}
                >
                  {pendingMedicationId === med.id ? "Guardando..." : objectiveCompletedToday ? "Objetivo completado" : "Marcar como tomado"}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-2xl border border-border/70 bg-card/85 flex items-center justify-center gap-2 text-sm font-semibold text-foreground shadow-sm disabled:opacity-60"
                    onClick={() => {
                      setEditingMedicationId(med.id);
                      setIsAddOpen(true);
                    }}
                  >
                    <Pencil className="size-5 text-primary" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-2xl border border-border/70 bg-card/85 flex items-center justify-center gap-2 text-sm font-semibold text-foreground shadow-sm disabled:opacity-60"
                    disabled={pendingMedicationId === med.id}
                    onClick={async () => {
                      try {
                        setPendingMedicationId(med.id);
                        setActionError(null);
                        await removeMedication(med.id);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "No se pudo borrar el medicamento.";
                        setActionError(message);
                      } finally {
                        setPendingMedicationId(null);
                      }
                    }}
                  >
                    <span className="text-lg">{pendingMedicationId === med.id ? "..." : "✕"}</span>
                    Borrar
                  </button>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">Última toma: {formatLastTaken(med.lastTakenAt)}</p>
            </div>
          </Card>
          );
        })}

        {actionError ? <Card className="app-page-card p-4 border border-red-200 bg-red-50 text-red-700 text-sm">{actionError}</Card> : null}

        {visibleMedications.length === 0 ? (
          <Card className="app-page-card p-7 text-center text-sm text-muted-foreground">No hay medicación activa.</Card>
        ) : null}
      </div>

      {isCaregiverRole ? (
        <button
          className="fixed bottom-24 right-4 size-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg flex items-center justify-center z-20"
          onClick={() => setIsAddOpen(true)}
          aria-label="Añadir medicamento"
        >
          <Plus className="size-7" strokeWidth={2.8} />
        </button>
      ) : null}

      <AddMedicationDialog
        open={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingMedicationId(null);
        }}
        title={editingMedicationId ? "Editar medicamento" : "Nuevo medicamento"}
        submitLabel={editingMedicationId ? "Guardar cambios" : "Guardar"}
        showClientAssignment={isCaregiverRole}
        clientOptions={clientOptions}
        initialValues={
          editingMedicationId
            ? (() => {
                const current = medications.find((item) => item.id === editingMedicationId);
                if (!current) {
                  return null;
                }

                return {
                  name: current.name,
                  dosage: current.dosage,
                  stock: current.stock,
                  boxType: current.boxType,
                  times: current.times,
                  daysOfWeek: current.daysOfWeek,
                  durationDays: current.durationDays,
                };
              })()
            : null
        }
        initialClientEmail={editingMedicationId && isCaregiverRole ? clientOptions[0] ?? "" : null}
        onSubmit={handleSubmitMedication}
      />

      <BottomNav />
    </div>
  );
}
