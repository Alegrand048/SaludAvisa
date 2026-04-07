import { useEffect, useMemo, useState } from "react";
import { Appointment } from "../models/appointment";
import { appointmentService } from "../services/appointmentService";
import { medicationService } from "../services/medicationService";

function formatearHora24a12(time24: string): string {
  const [hour, minute] = time24.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalizeMedicationBaseId(medicationId: string): string {
  return medicationId.startsWith("shared-") ? medicationId.replace("shared-", "") : medicationId;
}

function getSlotDate(baseDate: Date, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function useControladorPanel() {
  const [version, setVersion] = useState(0);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayTakenCountMap, setTodayTakenCountMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const refresh = async () => {
      const [loadedAppointments, loadedMedications, takenCountMap] = await Promise.all([
        appointmentService.getAllAsync(),
        medicationService.getAllAsync(),
        medicationService.getTodayTakenCountMapAsync(),
      ]);
      setAppointments(loadedAppointments);
      setMedications(loadedMedications);
      setTodayTakenCountMap(takenCountMap);
      setIsLoading(false);
    };

    void refresh();
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const [loadedAppointments, loadedMedications, takenCountMap] = await Promise.all([
        appointmentService.getAllAsync(),
        medicationService.getAllAsync(),
        medicationService.getTodayTakenCountMapAsync(),
      ]);
      setAppointments(loadedAppointments);
      setMedications(loadedMedications);
      setTodayTakenCountMap(takenCountMap);
      setIsLoading(false);
    };

    void refresh();
  }, [version]);

  const nextMedication = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(cutoff.getHours() + 24);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const candidates = medications
      .filter((medication) => medication.active)
      .flatMap((medication) =>
        [0, 1].flatMap((offset) => {
          const baseDate = new Date(now);
          baseDate.setDate(baseDate.getDate() + offset);

          if (!isMedicationAllowedOnDate(medication, baseDate)) {
            return [];
          }

          const isToday = isSameDay(baseDate, today);
          const takenToday = isToday ? todayTakenCountMap[normalizeMedicationBaseId(medication.id)] ?? 0 : 0;
          const sortedTimes = [...medication.times].sort();

          return sortedTimes.flatMap((time, index) => {
            if (isToday && index < takenToday) {
              return [];
            }

            const date = getSlotDate(baseDate, time);
            if (date > cutoff) {
              return [];
            }

            if (!isToday && date < now) {
              return [];
            }

            return [{ medication, time, date }];
          });
        }),
      )
      .sort((a, b) => {
        const aLate = a.date < now;
        const bLate = b.date < now;
        if (aLate !== bLate) {
          return aLate ? -1 : 1;
        }
        return a.date.getTime() - b.date.getTime();
      });

    const next = candidates[0];
    if (!next) {
      return null;
    }

    const diffMinutes = Math.round((next.date.getTime() - now.getTime()) / 60000);
    const minutesUntil = Math.max(0, diffMinutes);
    return {
      medication: next.medication,
      time: next.time,
      minutesUntil,
      isLate: diffMinutes < 0,
      lateMinutes: Math.abs(Math.min(0, diffMinutes)),
      timeLabel: formatearHora24a12(next.time),
    };
  }, [medications, todayTakenCountMap]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return (
      appointments
        .filter((appointment) => new Date(appointment.dateTime) >= now)
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0] ?? null
    );
  }, [appointments]);

  const refrescar = () => setVersion((current) => current + 1);

  return {
    nextMedication: nextMedication
      ? {
          ...nextMedication,
          timeLabel: formatearHora24a12(nextMedication.time),
        }
      : null,
    nextAppointment: nextAppointment as Appointment | null,
    refresh: refrescar,
    isLoading,
  };
}

export const useDashboardController = useControladorPanel;
