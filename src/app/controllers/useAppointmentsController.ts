import { useEffect, useState } from "react";
import { Appointment } from "../models/appointment";
import { appointmentService } from "../services/appointmentService";

export function useControladorCitas() {
  const [appointments, setAppointments] = useState<Appointment[]>(() => appointmentService.getAll());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      setIsLoading(true);
      const loaded = await appointmentService.getAllAsync();
      if (mounted) {
        setAppointments(loaded);
        setIsLoading(false);
      }
    };
    void cargar();
    return () => {
      mounted = false;
    };
  }, []);

  const addAppointment = async (appointment: Omit<Appointment, "id">, targetClientEmail?: string) => {
    setAppointments(await appointmentService.addAsync(appointment, targetClientEmail));
  };

  const updateAppointment = async (id: string, updates: Partial<Omit<Appointment, "id">>) => {
    setAppointments(await appointmentService.updateAsync(id, updates));
  };

  const removeAppointment = async (id: string) => {
    setAppointments(await appointmentService.deleteAsync(id));
  };

  return {
    appointments,
    count: appointments.length,
    isLoading,
    addAppointment,
    updateAppointment,
    removeAppointment,
  };
}

export const useAppointmentsController = useControladorCitas;
