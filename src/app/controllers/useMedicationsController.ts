import { useEffect, useMemo, useState } from "react";
import { Medication } from "../models/medication";
import { medicationService } from "../services/medicationService";
import { supabase } from "../services/supabaseClient";

export function useControladorMedicacion() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todayTakenCountMap, setTodayTakenCountMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

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

    const scheduleRefresh = () => {
      if (!mounted) {
        return;
      }
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        void cargar();
      }, 150);
    };

    cargar();

    const channel = supabase
      .channel(`medications-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medicamentos_usuario" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medicamentos_familia_compartidos" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registro_tomas_medicacion" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      mounted = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
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
