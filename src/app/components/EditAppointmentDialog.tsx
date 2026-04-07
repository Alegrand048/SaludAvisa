import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { hospitalSearchService } from "../services/hospitalSearchService";

interface EditAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment?: {
    id: string;
    specialty: string;
    location: string;
    doctor: string;
    dateTime: string;
  } | null;
  onSubmit: (payload: {
    specialty: string;
    location: string;
    doctor: string;
    date: string;
    time: string;
  }) => Promise<void>;
}

export function EditAppointmentDialog({
  open,
  onClose,
  appointment,
  onSubmit,
}: EditAppointmentDialogProps) {
  const [specialty, setSpecialty] = useState("");
  const [location, setLocation] = useState("");
  const [doctor, setDoctor] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);

  const formatLocalDate = (value: string): string => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatLocalTime = (value: string): string => {
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  useEffect(() => {
    if (!open || !appointment) {
      return;
    }

    setSpecialty(appointment.specialty);
    setLocation(appointment.location);
    setDoctor(appointment.doctor);

    setDate(formatLocalDate(appointment.dateTime));
    setTime(formatLocalTime(appointment.dateTime));
    setSubmitError(null);
  }, [open, appointment]);

  const reset = () => {
    setSpecialty("");
    setLocation("");
    setDoctor("");
    setDate("");
    setTime("");
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!specialty.trim() || !location.trim() || !doctor.trim() || !date.trim() || !time.trim()) {
      setSubmitError("Completa todos los campos obligatorios.");
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
      });
      reset();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la cita.";
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">Editar cita médica</DialogTitle>
          <p className="text-sm text-muted-foreground">Actualiza los datos de la cita.</p>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="edit-apt-specialty">Especialidad</Label>
            <Input
              id="edit-apt-specialty"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-apt-location">Centro o clínica</Label>
            <div className="relative">
              <Input
                id="edit-apt-location"
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
            <Label htmlFor="edit-apt-doctor">Doctor o doctora</Label>
            <Input
              id="edit-apt-doctor"
              value={doctor}
              onChange={(event) => setDoctor(event.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-apt-date">Fecha</Label>
              <Input
                id="edit-apt-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apt-time">Hora</Label>
              <Input
                id="edit-apt-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background"
                required
              />
            </div>
          </div>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-2xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-11 rounded-2xl">
              {saving ? "Guardando..." : "Actualizar cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
