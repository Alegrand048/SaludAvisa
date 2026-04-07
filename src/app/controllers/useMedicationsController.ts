import { useEffect, useMemo, useState } from "react";
import { Medication } from "../models/medication";
import { medicationService } from "../services/medicationService";

export function useControladorMedicacion() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todayTakenCountMap, setTodayTakenCountMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      const [loaded, takenCountMap] = await Promise.all([
        medicationService.getAllAsync(),
        medicationService.getTodayTakenCountMapAsync(),
      ]);
      if (mounted) {
        setMedications(loaded);
        setTodayTakenCountMap(takenCountMap);
        setIsLoading(false);
      }
    };
    cargar();
    return () => {
      mounted = false;
    };
  }, []);

  const medicamentosActivos = useMemo(
    () => medications.filter((medication) => medication.active),
    [medications],
  );

  const markAsTaken = async (id: string) => {
    const updated = await medicationService.markAsTakenAsync(id);
    const takenCountMap = await medicationService.getTodayTakenCountMapAsync();
    setMedications(updated);
    setTodayTakenCountMap(takenCountMap);
  };

  const addMedication = async (medication: Omit<Medication, "id">, targetClientEmail?: string) => {
    const updated = await medicationService.addAsync(medication, targetClientEmail);
    const takenCountMap = await medicationService.getTodayTakenCountMapAsync();
    setMedications(updated);
    setTodayTakenCountMap(takenCountMap);
  };

  const editMedication = async (id: string, medication: Omit<Medication, "id">, targetClientEmail?: string) => {
    const updated = await medicationService.updateAsync(id, medication, targetClientEmail);
    const takenCountMap = await medicationService.getTodayTakenCountMapAsync();
    setMedications(updated);
    setTodayTakenCountMap(takenCountMap);
  };

  const removeMedication = async (id: string) => {
    const updated = await medicationService.removeAsync(id);
    const takenCountMap = await medicationService.getTodayTakenCountMapAsync();
    setMedications(updated);
    setTodayTakenCountMap(takenCountMap);
  };

  return {
    medications: medicamentosActivos,
    count: medicamentosActivos.length,
    isLoading,
    todayTakenCountMap,
    markAsTaken,
    addMedication,
    editMedication,
    removeMedication,
  };
}

export const useMedicationsController = useControladorMedicacion;
