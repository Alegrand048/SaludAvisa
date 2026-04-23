import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  cimaMedicationApiService,
  SugerenciaMedicamentoCima,
} from "../services/cimaMedicationApiService";

interface AddMedicationDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  submitLabel?: string;
  showClientAssignment?: boolean;
  clientOptions?: string[];
  initialValues?: {
    name: string;
    dosage: string;
    stock: number;
    boxType?: string;
    times: string[];
    daysOfWeek?: string[];
    durationDays?: number;
    startDate?: string;
  } | null;
  initialClientEmail?: string | null;
  onSubmit: (payload: {
    name: string;
    dosage: string;
    stock: number;
    boxType: string;
    times: string[];
    frequencyLabel: string;
    daysOfWeek: string[];
    durationDays: number;
    startDate: string;
    clientEmail?: string;
  }) => Promise<void>;
}

const DAYS_OF_WEEK = [
  { value: "mon", label: "L" },
  { value: "tue", label: "M" },
  { value: "wed", label: "X" },
  { value: "thu", label: "J" },
  { value: "fri", label: "V" },
  { value: "sat", label: "S" },
  { value: "sun", label: "D" },
];

const DURATION_PRESETS = [2, 7, 30];

function weekdayCode(date: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] ?? "mon";
}

function getTodayLocalDateIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddMedicationDialog({
  open,
  onClose,
  title = "Nuevo medicamento",
  submitLabel = "Guardar",
  showClientAssignment = false,
  clientOptions = [],
  initialValues = null,
  initialClientEmail = null,
  onSubmit,
}: AddMedicationDialogProps) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [stock, setStock] = useState("30");
  const [boxType, setBoxType] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [vecesAlDia, setVecesAlDia] = useState(1);
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(DAYS_OF_WEEK.map((day) => day.value));
  const [durationDays, setDurationDays] = useState("30");
  const [startDate, setStartDate] = useState(() => getTodayLocalDateIso());
  const [singleDayMode, setSingleDayMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaMedicamentoCima[]>([]);
  const [buscandoSugerencias, setBuscandoSugerencias] = useState(false);
  const [errorSugerencias, setErrorSugerencias] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDosage("");
    setStock("30");
    setBoxType("");
    setClientEmail("");
    setVecesAlDia(1);
    setTimes(["08:00"]);
    setDaysOfWeek(DAYS_OF_WEEK.map((day) => day.value));
    setDurationDays("30");
    setStartDate(getTodayLocalDateIso());
    setSingleDayMode(false);
    setSugerencias([]);
    setErrorSugerencias(null);
    setSubmitError(null);
  };

  const frecuenciaLabel = `${vecesAlDia} ${vecesAlDia === 1 ? "vez" : "veces"} al dia`;

  const handleChangeVecesAlDia = (nextValue: number) => {
    setVecesAlDia(nextValue);
    setTimes((actuales) => {
      if (actuales.length === nextValue) {
        return actuales;
      }
      if (actuales.length > nextValue) {
        return actuales.slice(0, nextValue);
      }

      const extended = [...actuales];
      for (let index = actuales.length; index < nextValue; index += 1) {
        extended.push("08:00");
      }
      return extended;
    });
  };

  const handleChangeHora = (index: number, value: string) => {
    setTimes((actuales) => actuales.map((hora, idx) => (idx === index ? value : hora)));
  };

  const toggleDay = (day: string) => {
    setDaysOfWeek((actuales) =>
      actuales.includes(day) ? actuales.filter((item) => item !== day) : [...actuales, day],
    );
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!initialValues) {
      return;
    }

    setName(initialValues.name);
    setDosage(initialValues.dosage);
    setStock(String(initialValues.stock));
    setBoxType(initialValues.boxType ?? "");
    setTimes(initialValues.times.length > 0 ? initialValues.times : ["08:00"]);
    setVecesAlDia(initialValues.times.length > 0 ? initialValues.times.length : 1);
    setDaysOfWeek(initialValues.daysOfWeek && initialValues.daysOfWeek.length > 0 ? initialValues.daysOfWeek : DAYS_OF_WEEK.map((day) => day.value));
    setDurationDays(String(initialValues.durationDays ?? 30));
    setStartDate(initialValues.startDate ?? getTodayLocalDateIso());
    setSingleDayMode((initialValues.durationDays ?? 30) === 1);
    setSubmitError(null);
  }, [open, initialValues]);

  useEffect(() => {
    if (!showClientAssignment) {
      return;
    }
    if (initialClientEmail) {
      setClientEmail(initialClientEmail);
      return;
    }
    if (clientOptions.length === 0) {
      setClientEmail("");
      return;
    }
    setClientEmail((current) => current || clientOptions[0]);
  }, [clientOptions, showClientAssignment, initialClientEmail]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const consulta = name.trim();
    if (consulta.length < 3) {
      setSugerencias([]);
      setBuscandoSugerencias(false);
      setErrorSugerencias(null);
      return;
    }

    let mounted = true;
    setBuscandoSugerencias(true);
    setErrorSugerencias(null);

    const timer = setTimeout(() => {
      void cimaMedicationApiService
        .buscarPorNombre(consulta)
        .then((items) => {
          if (!mounted) {
            return;
          }
          setSugerencias(items);
          if (items.length === 0) {
            setErrorSugerencias("No se encontraron coincidencias en CIMA");
          }
        })
        .catch(() => {
          if (!mounted) {
            return;
          }
          setSugerencias([]);
          setErrorSugerencias("No se pudo consultar la API de medicamentos");
        })
        .finally(() => {
          if (mounted) {
            setBuscandoSugerencias(false);
          }
        });
    }, 350);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [name, open]);

  const seleccionarSugerencia = (item: SugerenciaMedicamentoCima) => {
    setName(item.nombre);
    setDosage(item.dosis);
    if (!boxType) {
      setBoxType(item.tipoCajaSugerido);
    }
    setSugerencias([]);
    setErrorSugerencias(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setSubmitError(null);

      const requiresClientSelection = showClientAssignment;
      const normalizedClientEmail = clientEmail.trim() || (showClientAssignment ? (clientOptions[0]?.trim() ?? "") : "");

        if (requiresClientSelection && !normalizedClientEmail) {
        setSubmitError("Selecciona un cliente del grupo familiar.");
        return;
      }

      const effectiveDaysOfWeek = singleDayMode
        ? [weekdayCode(new Date(`${startDate}T00:00:00`))]
        : daysOfWeek;
      const effectiveDurationDays = singleDayMode ? 1 : Number(durationDays) || 0;

      if (effectiveDaysOfWeek.length === 0) {
        setSubmitError("Selecciona al menos un día o usa la opción de un solo día.");
        return;
      }

      await onSubmit({
        name,
        dosage,
        stock: Number(stock),
        boxType,
        times,
        frequencyLabel: frecuenciaLabel,
        daysOfWeek: effectiveDaysOfWeek,
        durationDays: effectiveDurationDays,
        startDate,
        clientEmail: normalizedClientEmail ? normalizedClientEmail.toLowerCase() : undefined,
      });
      reset();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el medicamento.";
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">Completa la pauta y guarda el tratamiento en formato móvil.</p>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="med-name">Nombre</Label>
            <Input
              id="med-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Omeprazol (min. 3 letras para sugerencias CIMA)"
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
            {buscandoSugerencias ? (
              <p className="text-xs text-muted-foreground">Buscando en CIMA...</p>
            ) : null}
            {!buscandoSugerencias && errorSugerencias ? (
              <p className="text-xs text-muted-foreground">{errorSugerencias}</p>
            ) : null}
            {sugerencias.length > 0 ? (
              <div className="max-h-44 overflow-auto rounded-2xl border border-border/70 bg-background/95 shadow-sm">
                {sugerencias.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary/10"
                    onClick={() => seleccionarSugerencia(item)}
                  >
                    <p className="font-medium text-foreground">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">{item.dosis} · {item.tipoCajaSugerido}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-dose">Dosis</Label>
            <Input
              id="med-dose"
              value={dosage}
              onChange={(event) => setDosage(event.target.value)}
              placeholder="Ej. 20 mg"
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="med-stock">Stock</Label>
              <Input
                id="med-stock"
                type="number"
                min={0}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="med-frequency-count">Frecuencia diaria</Label>
              <select
                id="med-frequency-count"
                value={vecesAlDia}
                onChange={(event) => handleChangeVecesAlDia(Number(event.target.value))}
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm"
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value} {value === 1 ? "vez" : "veces"} al dia
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Horas de toma</Label>
            <div className="grid grid-cols-2 gap-3">
              {times.map((hora, index) => (
                <div key={`hora-${index}`} className="space-y-1">
                  <Label htmlFor={`med-time-${index}`}>Toma {index + 1}</Label>
                  <Input
                    id={`med-time-${index}`}
                    type="time"
                    value={hora}
                    onChange={(event) => handleChangeHora(index, event.target.value)}
                    className="h-11 rounded-2xl border-border/70 bg-background"
                    required
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Se guardara como: {frecuenciaLabel}</p>
          </div>

          <div className="space-y-2">
            <Label>Días de la semana</Label>
            <div className="flex flex-wrap gap-2 pb-1">
              <button
                type="button"
                onClick={() => setSingleDayMode(false)}
                className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors ${!singleDayMode ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-foreground"}`}
              >
                Repetir según días
              </button>
              <button
                type="button"
                onClick={() => setSingleDayMode(true)}
                className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors ${singleDayMode ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-foreground"}`}
              >
                Solo un día
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const selected = daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`size-10 rounded-2xl border text-sm font-semibold transition-colors disabled:opacity-40 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-foreground"}`}
                    aria-pressed={selected}
                    disabled={singleDayMode}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{singleDayMode ? "En modo un solo día se usa la fecha de inicio exacta." : "Selecciona los días en los que se tomará el medicamento."}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-start-date">Fecha de inicio</Label>
            <Input
              id="med-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-duration">Duración del tratamiento (días)</Label>
            <Input
              id="med-duration"
              type="number"
              min={1}
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
              placeholder="Ej. 30"
              className="h-11 rounded-2xl border-border/70 bg-background"
              required
              disabled={singleDayMode}
            />
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationDays(String(preset))}
                  className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${Number(durationDays) === preset ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-foreground"}`}
                  disabled={singleDayMode}
                >
                  {`${preset} días`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-box">Tipo de caja</Label>
            <Input
              id="med-box"
              value={boxType}
              onChange={(event) => setBoxType(event.target.value)}
              placeholder="Ej. Caja de 30 comprimidos"
              className="h-11 rounded-2xl border-border/70 bg-background"
            />
          </div>

          {showClientAssignment && clientOptions.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="med-client-email">Cliente destino</Label>
              <select
                id="med-client-email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm"
                required
              >
                {clientOptions.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Selecciona a qué cliente del grupo familiar asignarás este medicamento.
              </p>
            </div>
          ) : null}

              {showClientAssignment && clientOptions.length === 0 ? (
                  <p className="text-xs text-destructive">
                  No hay clientes vinculados ahora mismo. No se puede guardar hasta que haya un cliente en tu grupo familiar.
                </p>
              ) : null}

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-2xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-11 rounded-2xl">
              {saving ? "Guardando..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
