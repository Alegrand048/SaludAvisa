import { Appointment } from "../models/appointment";
import { readFromStorage, writeToStorage } from "./storage";

const STORAGE_KEY = "saludavisa.appointments";

const seedAppointments: Appointment[] = [
  {
    id: "1",
    specialty: "Cardiologia",
    dateTime: "2026-03-31T10:30:00",
    location: "Centro Medico San Juan",
    doctor: "Dr. Garcia Lopez",
    emoji: "❤️",
    color: "from-red-100 to-red-50",
  },
  {
    id: "2",
    specialty: "Oftalmologia",
    dateTime: "2026-04-02T15:00:00",
    location: "Clinica Vista Clara",
    doctor: "Dra. Martinez Ruiz",
    emoji: "👁️",
    color: "from-blue-100 to-blue-50",
  },
  {
    id: "3",
    specialty: "Traumatologia",
    dateTime: "2026-04-11T11:00:00",
    location: "Hospital Central",
    doctor: "Dr. Rodriguez Perez",
    emoji: "🦴",
    color: "from-green-100 to-green-50",
  },
];

function getStoredAppointments(): Appointment[] {
  return readFromStorage<Appointment[]>(STORAGE_KEY, seedAppointments)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

function saveAppointments(appointments: Appointment[]): void {
  writeToStorage(STORAGE_KEY, appointments);
}

export const appointmentService = {
  getAll(): Appointment[] {
    return getStoredAppointments();
  },

  getNext(now: Date = new Date()): Appointment | null {
    return getStoredAppointments().find((appointment) => new Date(appointment.dateTime) >= now) ?? null;
  },

  add(appointment: Appointment): Appointment[] {
    const updated = [...getStoredAppointments(), appointment].sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    );
    saveAppointments(updated);
    return updated;
  },

  remove(id: string): Appointment[] {
    const updated = getStoredAppointments().filter((appointment) => appointment.id !== id);
    saveAppointments(updated);
    return updated;
  },
};
