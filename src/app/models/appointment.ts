export interface Cita {
  id: string;
  specialty: string;
  dateTime: string;
  location: string;
  doctor: string;
  emoji: string;
  color: string;
}

export type Appointment = Cita;
