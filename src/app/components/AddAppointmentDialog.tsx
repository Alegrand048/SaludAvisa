import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { hospitalSearchService } from "../services/hospitalSearchService";

interface AddAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  showClientAssignment?: boolean;
  clientOptions?: string[];
  onSubmit: (payload: {
    specialty: string;
    location: string;
    doctor: string;
    date: string;
    time: string;
    clientEmail?: string;
  }) => Promise<void>;
}

export function AddAppointmentDialog({
  open,
  onClose,
  showClientAssignment = false,
  clientOptions = [],
  onSubmit,
}: AddAppointmentDialogProps) {
  const [specialty, setSpecialty] = useState("Medicina general");
  const [location, setLocation] = useState("Centro médico");
  const [doctor, setDoctor] = useState("Dr./Dra.");
  const [date, setDate] = useState("2026-04-20");
  const [time, setTime] = useState("10:30");
  const [clientEmail, setClientEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (showClientAssignment && clientOptions.length > 0) {
      setClientEmail((current) => current || clientOptions[0]);
    }
  }, [open, showClientAssignment, clientOptions]);

  const reset = () => {
    setSpecialty("Medicina general");
    setLocation("Centro médico");
    setDoctor("Dr./Dra.");
    setDate("2026-04-20");
    setTime("10:30");
    setClientEmail("");
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!specialty.trim() || !location.trim() || !doctor.trim() || !date.trim() || !time.trim()) {
      setSubmitError("Completa todos los campos obligatorios.");
      return;
    }

    if (showClientAssignment && !clientEmail.trim()) {
      setSubmitError("Selecciona un cliente del grupo familiar.");
      return;
    }

    try {
      setSaving(true);
      await onSubmit({
        specialty: specialty.trim(),
        location: location.trim(),
        doctor: doctor.trim(),
        date: date.trim(),
        time: time.trim(),
        clientEmail: clientEmail.trim() ? clientEmail.trim().toLowerCase() : undefined,
      });
      reset();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la cita.";
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">Nueva cita médica</DialogTitle>
          <p className="text-sm text-muted-foreground">Añade una cita con la misma estética de la app móvil.</p>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="apt-specialty">Especialidad</Label>
            <Input
              id="apt-specialty"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apt-location">Centro o clínica</Label>
            <div className="relative">
              <Input
                id="apt-location"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  void hospitalSearchService.searchHospitals(event.target.value).then(setLocationSuggestions);
                }}
                onFocus={() => {
                  if (location.trim()) {
                    void hospitalSearchService.searchHospitals(location).then(setLocationSuggestions);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on suggestions
                  setTimeout(() => setLocationSuggestions([]), 200);
                }}
                className="h-11 rounded-2xl border-border/70 bg-background"
                required
              />
              {locationSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/70 rounded-2xl max-h-48 overflow-y-auto z-10 shadow-lg">
                  {locationSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 border-b border-border/60 last:border-b-0 transition-colors"
                      onClick={() => {
                        setLocation(suggestion);
                        setLocationSuggestions([]);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apt-doctor">Doctor o doctora</Label>
            <Input
              id="apt-doctor"
              value={doctor}
              onChange={(event) => setDoctor(event.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="apt-date">Fecha</Label>
              <Input
                id="apt-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apt-time">Hora</Label>
              <Input
                id="apt-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background"
                required
              />
            </div>
          </div>

          {showClientAssignment ? (
            <div className="space-y-2">
              <Label htmlFor="apt-client-email">Cliente destino</Label>
              <select
                id="apt-client-email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm"
                required
                disabled={clientOptions.length === 0}
              >
                {clientOptions.length === 0 ? <option value="">No hay clientes disponibles</option> : null}
                {clientOptions.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Selecciona a qué cliente del grupo familiar asignarás esta cita.
              </p>
            </div>
          ) : null}

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-2xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-11 rounded-2xl">
              {saving ? "Guardando..." : "Guardar cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
