import { useState } from "react";
import { Appointment } from "../models/appointment";
import { appointmentService } from "../services/appointmentService";

export function useAppointmentsController() {
  const [appointments] = useState<Appointment[]>(() => appointmentService.getAll());

  return {
    appointments,
    count: appointments.length,
  };
}
