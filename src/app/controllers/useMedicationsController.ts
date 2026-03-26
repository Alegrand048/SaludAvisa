import { useMemo, useState } from "react";
import { Medication } from "../models/medication";
import { medicationService } from "../services/medicationService";

export function useMedicationsController() {
  const [medications, setMedications] = useState<Medication[]>(() => medicationService.getAll());

  const activeMedications = useMemo(
    () => medications.filter((medication) => medication.active),
    [medications],
  );

  const markAsTaken = (id: string) => {
    setMedications(medicationService.markAsTaken(id));
  };

  return {
    medications: activeMedications,
    count: activeMedications.length,
    markAsTaken,
  };
}
