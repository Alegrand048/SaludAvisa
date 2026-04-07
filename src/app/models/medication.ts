export interface Medicamento {
  id: string;
  name: string;
  dosage: string;
  stock: number;
  boxType?: string;
  times: string[];
  daysOfWeek?: string[];
  durationDays?: number;
  startDate?: string;
  frequencyLabel: string;
  treatmentEndDate?: string;
  color: string;
  emoji: string;
  active: boolean;
  lastTakenAt?: string;
}

export type Medication = Medicamento;
