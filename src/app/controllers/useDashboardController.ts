import { useMemo, useState } from "react";
import { Appointment } from "../models/appointment";
import { appointmentService } from "../services/appointmentService";
import { medicationService } from "../services/medicationService";

function formatTime24To12(time24: string): string {
  const [hour, minute] = time24.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function useDashboardController() {
  const [version, setVersion] = useState(0);

  const nextMedication = useMemo(() => medicationService.getNext(), [version]);
  const nextAppointment = useMemo(() => appointmentService.getNext(), [version]);

  const refresh = () => setVersion((current) => current + 1);

  return {
    nextMedication: nextMedication
      ? {
          ...nextMedication,
          timeLabel: formatTime24To12(nextMedication.time),
        }
      : null,
    nextAppointment: nextAppointment as Appointment | null,
    refresh,
  };
}
