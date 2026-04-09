import { Pill, Calendar, Plus, Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useDashboardController } from "../controllers/useDashboardController";
import { useProfileController } from "../controllers/useProfileController";
import { useMedicationsController } from "../controllers/useMedicationsController";
import { useAuthSession } from "../context/AuthSessionContext";

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

function formatMinutesUntil(minutes: number): string {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const remainingMinutes = safe % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

export default function Home() {
  const navigate = useNavigate();
  const { nextMedication, nextAppointment, refresh, isLoading } = useDashboardController();
  const { profile } = useProfileController();
  const { markAsTaken, medications } = useMedicationsController();
  const { isCaregiverRole } = useAuthSession();
  const [markingTaken, setMarkingTaken] = useState(false);
  const displayInitial = (profile.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  const lowStockMedications = medications.filter((medication) => medication.stock < 5);

  const handleMarkAsTaken = async () => {
    if (!nextMedication) {
      return;
    }

    try {
      setMarkingTaken(true);
      await markAsTaken(nextMedication.medication.id);
      refresh();
    } finally {
      setMarkingTaken(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-header-glass px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-[1.15rem] bg-primary/12 text-primary border border-primary/15 shadow-sm flex items-center justify-center overflow-hidden">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold tracking-tight">{displayInitial}</span>
                )}
              </div>
              <div className="space-y-1">
                <span className="eyebrow-chip">SaludAvisa</span>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2.15rem]">Hola, {profile.name}</h1>
                {isCaregiverRole ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="status-chip status-chip--positive">Panel de cuidador</span>
                    <span className="status-chip status-chip--muted">Resumen de hoy</span>
                  </div>
                ) : null}
              </div>
            </div>
            <button
              className="size-12 rounded-2xl border border-border/70 bg-card/90 text-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-secondary/80 flex items-center justify-center overflow-hidden"
              onClick={() => navigate("/profile")}
              aria-label="Ir a perfil"
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <Bell className="size-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="app-main">
        <section className="space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Pill className="size-6 text-primary" />
            Próxima medicación
          </h2>
          <Card className="app-page-card p-5 sm:p-6 border-0">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-6 w-40 rounded-full bg-primary/10 animate-pulse" />
                <div className="h-4 w-28 rounded-full bg-primary/10 animate-pulse" />
                <div className="h-12 w-full rounded-2xl bg-primary/10 animate-pulse" />
              </div>
            ) : nextMedication ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span className={nextMedication.isLate ? "status-chip status-chip--warning" : "status-chip status-chip--positive"}>
                        {nextMedication.isLate ? "Toma retrasada" : "Próxima toma"}
                      </span>
                      <span className="status-chip status-chip--muted">{nextMedication.timeLabel}</span>
                    </div>
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2.1rem]">{nextMedication.medication.name}</h3>
                    <p className="text-lg text-muted-foreground sm:text-xl">{nextMedication.medication.dosage}</p>
                  </div>
                  <div className="size-16 rounded-[1.4rem] bg-primary/10 text-primary flex items-center justify-center shadow-sm shrink-0">
                    <Pill className="size-8" />
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-border/70 bg-background/70 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cuenta regresiva</p>
                  <p className={`mt-2 text-2xl font-semibold tracking-tight ${nextMedication.isLate ? "text-destructive" : "text-primary"}`}>
                    {nextMedication.isLate
                      ? `Llega tarde por ${formatMinutesUntil(nextMedication.lateMinutes)}`
                      : `En ${formatMinutesUntil(nextMedication.minutesUntil)}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {nextMedication.isLate ? "Se te esta haciendo tarde" : "Todo está dentro de la franja prevista."}
                  </p>
                </div>

                <Button
                  size="lg"
                  className={`w-full h-14 text-base font-semibold rounded-2xl ${nextMedication.isLate ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}
                  disabled={markingTaken}
                  onClick={() => {
                    void handleMarkAsTaken();
                  }}
                >
                  {markingTaken ? "Guardando toma..." : "Marcar como tomado"}
                </Button>
              </div>
            ) : !isLoading ? (
              <div className="grid place-items-center gap-2 rounded-[1.35rem] border border-dashed border-border/70 bg-background/50 py-10 text-center">
                <Pill className="size-8 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">No hay medicación programada</p>
                <p className="text-sm text-muted-foreground">Cuando tengas medicamentos pendientes apareceran aqui</p>
              </div>
            ) : null}
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Calendar className="size-6 text-primary" />
            Próxima cita médica
          </h2>
          <Card className="app-page-card p-5 sm:p-6 border-0">
            {nextAppointment ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="status-chip status-chip--muted">{formatAppointmentDate(nextAppointment.dateTime)}</span>
                      {nextAppointment.isDelayed ? (
                        <span className="status-chip status-chip--warning">Retrasada {nextAppointment.delayedMinutes} min</span>
                      ) : null}
                    </div>
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2.1rem]">{nextAppointment.specialty}</h3>
                    <p className="text-lg text-muted-foreground sm:text-xl">{nextAppointment.doctor}</p>
                  </div>
                  <div className="size-16 rounded-[1.4rem] bg-secondary/60 flex items-center justify-center shadow-sm shrink-0 text-3xl">
                    {nextAppointment.emoji}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fecha</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{formatAppointmentDate(nextAppointment.dateTime)}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hora</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{formatAppointmentTime(nextAppointment.dateTime)}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lugar</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{nextAppointment.location}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid place-items-center gap-2 rounded-[1.35rem] border border-dashed border-border/70 bg-background/50 py-10 text-center">
                <Calendar className="size-8 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">No hay citas pendientes</p>
                <p className="text-sm text-muted-foreground">Aqui te apareceran las citas pendientes</p>
              </div>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate("/medications")}
            size="lg"
            variant="outline"
            className="h-24 flex-col gap-2 rounded-[1.35rem] border-border/70 bg-card/85 text-sm font-semibold shadow-sm hover:bg-secondary/70"
          >
            <Plus className="size-7" />
            {isCaregiverRole ? "Añadir medicación" : "Ver medicación"}
          </Button>

          <Button
            onClick={() => navigate("/appointments")}
            size="lg"
            variant="outline"
            className="h-24 flex-col gap-2 rounded-[1.35rem] border-border/70 bg-card/85 text-sm font-semibold shadow-sm hover:bg-secondary/70"
          >
            <Plus className="size-7" />
            {isCaregiverRole ? "Añadir cita" : "Ver citas"}
          </Button>
        </section>

        {isCaregiverRole && lowStockMedications.length > 0 ? (
          <Card className="app-page-card border-0 p-5">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-2xl bg-secondary/75 flex items-center justify-center shadow-sm shrink-0">
                <span className="text-2xl">⚠</span>
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Stock bajo detectado</p>
                <p className="text-sm text-muted-foreground">
                  {lowStockMedications.length} medicamento(s) están por debajo de 5 unidades.
                </p>
                <p className="text-sm text-foreground/90">
                  {lowStockMedications.slice(0, 3).map((item) => `${item.name} (${item.stock})`).join(" · ")}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {isCaregiverRole ? (
        <Card className="app-page-card border-0 bg-gradient-to-br from-slate-50 to-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-2xl">💡</span>
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Consejo del día</p>
              <p className="text-sm text-muted-foreground">
                Tómate un momento para revisar la próxima toma y evita que se acumulen recordatorios.
              </p>
            </div>
          </div>
        </Card>
        ) : null}

      </div>

      <BottomNav />
    </div>
  );
}
