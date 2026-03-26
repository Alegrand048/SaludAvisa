export interface Medication {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  frequencyLabel: string;
  treatmentEndDate?: string;
  color: string;
  emoji: string;
  active: boolean;
  lastTakenAt?: string;
}
