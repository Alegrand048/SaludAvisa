import { Medication } from "../models/medication";
import { readFromStorage, writeToStorage } from "./storage";

const STORAGE_KEY = "saludavisa.medications";

const seedMedications: Medication[] = [
  {
    id: "1",
    name: "Omeprazol",
    dosage: "20 mg",
    times: ["08:00", "14:00"],
    frequencyLabel: "2 veces al dia",
    color: "from-blue-100 to-blue-50",
    emoji: "💊",
    active: true,
  },
  {
    id: "2",
    name: "Aspirina",
    dosage: "100 mg",
    times: ["09:00"],
    frequencyLabel: "1 vez al dia",
    color: "from-green-100 to-green-50",
    emoji: "💊",
    active: true,
  },
  {
    id: "3",
    name: "Metformina",
    dosage: "850 mg",
    times: ["13:00", "20:00"],
    frequencyLabel: "2 veces al dia",
    color: "from-purple-100 to-purple-50",
    emoji: "💊",
    active: true,
  },
  {
    id: "4",
    name: "Enalapril",
    dosage: "10 mg",
    times: ["09:00"],
    frequencyLabel: "1 vez al dia",
    color: "from-pink-100 to-pink-50",
    emoji: "💊",
    active: true,
  },
];

function getStoredMedications(): Medication[] {
  return readFromStorage<Medication[]>(STORAGE_KEY, seedMedications);
}

function saveMedications(medications: Medication[]): void {
  writeToStorage(STORAGE_KEY, medications);
}

function toTodayDateWithTime(time: string, now: Date): Date {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function getNextDose(now: Date, medications: Medication[]) {
  const candidates = medications
    .filter((medication) => medication.active)
    .flatMap((medication) =>
      medication.times.map((time) => ({
        medication,
        time,
        date: toTodayDateWithTime(time, now),
      })),
    )
    .map((entry) => {
      const date = entry.date >= now ? entry.date : new Date(entry.date.getTime() + 24 * 60 * 60 * 1000);
      return { ...entry, date };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return candidates[0] ?? null;
}

export const medicationService = {
  getAll(): Medication[] {
    return getStoredMedications();
  },

  getNext(now: Date = new Date()) {
    const next = getNextDose(now, getStoredMedications());
    if (!next) {
      return null;
    }

    const minutesUntil = Math.max(0, Math.round((next.date.getTime() - now.getTime()) / 60000));
    return {
      medication: next.medication,
      time: next.time,
      minutesUntil,
    };
  },

  markAsTaken(id: string): Medication[] {
    const updated = getStoredMedications().map((medication) =>
      medication.id === id ? { ...medication, lastTakenAt: new Date().toISOString() } : medication,
    );
    saveMedications(updated);
    return updated;
  },

  add(medication: Medication): Medication[] {
    const updated = [...getStoredMedications(), medication];
    saveMedications(updated);
    return updated;
  },

  remove(id: string): Medication[] {
    const updated = getStoredMedications().filter((medication) => medication.id !== id);
    saveMedications(updated);
    return updated;
  },
};
