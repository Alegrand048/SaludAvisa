import { Medication } from "../models/medication";
import { readFromStorage, writeToStorage } from "./storage";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "saludavisa.medications";
const TABLE_NAME_ES = "medicamentos_usuario";
const SHARED_TABLE = "medicamentos_familia_compartidos";
const TAKEN_LOG_TABLE = "registro_tomas_medicacion";
const LEGACY_DEMO_MEDICATION_IDS = new Set(["1", "2", "3"]);
const LEGACY_DEMO_MEDICATION_NAME_HINTS = ["omeprazol", "aspirina", "paracetamol"];

interface MedicationRowEs {
  id: string;
  usuario_id: string;
  nombre: string;
  dosis: string;
  stock: number;
  tipo_caja: string | null;
  horarios: string[];
  etiqueta_frecuencia: string;
  fecha_fin_tratamiento: string | null;
  color: string;
  emoji: string;
  activa: boolean;
  ultima_toma_en: string | null;
  creado_en?: string;
  dias_semana?: string[] | null;
  duracion_dias?: number | null;
  fecha_inicio?: string | null;
}

interface SharedMedicationRow {
  id: string;
  creador_usuario_id: string;
  cliente_email: string;
  nombre: string;
  dosis: string;
  stock: number;
  tipo_caja: string | null;
  horarios: string[];
  etiqueta_frecuencia: string;
  fecha_fin_tratamiento: string | null;
  color: string;
  emoji: string;
  activa: boolean;
  ultima_toma_en: string | null;
  creado_en?: string;
  dias_semana?: string[] | null;
  duracion_dias?: number | null;
  fecha_inicio?: string | null;
}

interface AuthUserContext {
  id: string;
  email: string;
  role: string;
}

export interface MedicationTakenLog {
  medicationId: string;
  medicationName: string;
  dosage: string;
  takenAt: string;
  completed: boolean;
  stockRemaining: number;
  recordedByEmail?: string | null;
}

const seedMedications: Medication[] = [];

function isLegacyDemoMedication(medication: Medication): boolean {
  const normalizedName = medication.name.trim().toLowerCase();
  return (
    LEGACY_DEMO_MEDICATION_IDS.has(normalizeMedicationId(medication.id)) ||
    LEGACY_DEMO_MEDICATION_NAME_HINTS.some((hint) => normalizedName.includes(hint))
  );
}

function getStoredMedications(): Medication[] {
  const loaded = readFromStorage<Medication[]>(STORAGE_KEY, seedMedications);
  const cleaned = loaded.filter((medication) => !isLegacyDemoMedication(medication));

  if (cleaned.length !== loaded.length) {
    writeToStorage(STORAGE_KEY, cleaned);
  }

  return cleaned;
}

function saveMedications(medications: Medication[]): void {
  writeToStorage(STORAGE_KEY, medications);
}

function dedupeMedications(items: Medication[]): Medication[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function normalizeMedicationKey(id: string): string {
  return id.startsWith("shared-") ? id.replace("shared-", "") : id;
}

function normalizeMedicationId(id: string): string {
  return normalizeMedicationKey(id);
}

function generateMedicationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isMedicationObjectiveCompletedToday(
  medicationId: string,
  medication: { times: string[]; daysOfWeek?: string[]; durationDays?: number; startDate?: string },
  todayTakenCountMap: Record<string, number>,
): boolean {
  const takenToday = todayTakenCountMap[normalizeMedicationKey(medicationId)] ?? 0;
  const scheduledToday = countScheduledDosesForDate(medication, new Date());
  return scheduledToday > 0 && takenToday >= scheduledToday;
}

function removeByPossibleIds(items: Medication[], id: string): Medication[] {
  const baseId = normalizeMedicationId(id);
  const sharedId = `shared-${baseId}`;
  return items.filter((medication) => medication.id !== id && medication.id !== baseId && medication.id !== sharedId);
}

function rowEsToMedication(row: MedicationRowEs): Medication {
  return {
    id: row.id,
    name: row.nombre,
    dosage: row.dosis,
    stock: row.stock,
    boxType: row.tipo_caja ?? undefined,
    times: row.horarios,
    frequencyLabel: row.etiqueta_frecuencia,
    treatmentEndDate: row.fecha_fin_tratamiento ?? undefined,
    color: row.color,
    emoji: row.emoji,
    active: row.activa,
    lastTakenAt: row.ultima_toma_en ?? undefined,
    daysOfWeek: row.dias_semana ?? undefined,
    durationDays: row.duracion_dias ?? undefined,
    startDate: row.fecha_inicio ?? undefined,
  };
}

function sharedRowToMedication(row: SharedMedicationRow, withSharedPrefix = true): Medication {
  return {
    id: withSharedPrefix ? `shared-${row.id}` : row.id,
    name: row.nombre,
    dosage: row.dosis,
    stock: row.stock,
    boxType: row.tipo_caja ?? undefined,
    times: row.horarios,
    frequencyLabel: row.etiqueta_frecuencia,
    treatmentEndDate: row.fecha_fin_tratamiento ?? undefined,
    color: row.color,
    emoji: row.emoji,
    active: row.activa,
    lastTakenAt: row.ultima_toma_en ?? undefined,
    daysOfWeek: row.dias_semana ?? undefined,
    durationDays: row.duracion_dias ?? undefined,
    startDate: row.fecha_inicio ?? undefined,
  };
}

function medicationToInsertEs(userId: string, medicationId: string, medication: Omit<Medication, "id">) {
  return {
    id: medicationId,
    usuario_id: userId,
    nombre: medication.name,
    dosis: medication.dosage,
    stock: medication.stock,
    tipo_caja: medication.boxType ?? null,
    horarios: medication.times,
    etiqueta_frecuencia: medication.frequencyLabel,
    fecha_fin_tratamiento: medication.treatmentEndDate ?? null,
    color: medication.color,
    emoji: medication.emoji,
    activa: medication.active,
    ultima_toma_en: medication.lastTakenAt ?? null,
    dias_semana: medication.daysOfWeek ?? [],
    duracion_dias: medication.durationDays ?? null,
    fecha_inicio: medication.startDate ?? null,
  };
}

function medicationToInsertEsLegacy(userId: string, medicationId: string, medication: Omit<Medication, "id">) {
  return {
    id: medicationId,
    usuario_id: userId,
    nombre: medication.name,
    dosis: medication.dosage,
    stock: medication.stock,
    tipo_caja: medication.boxType ?? null,
    horarios: medication.times,
    etiqueta_frecuencia: medication.frequencyLabel,
    fecha_fin_tratamiento: medication.treatmentEndDate ?? null,
    color: medication.color,
    emoji: medication.emoji,
    activa: medication.active,
    ultima_toma_en: medication.lastTakenAt ?? null,
  };
}

function medicationToSharedInsert(userId: string, medicationId: string, clientEmail: string, medication: Omit<Medication, "id">) {
  return {
    id: medicationId,
    creador_usuario_id: userId,
    cliente_email: clientEmail.trim().toLowerCase(),
    nombre: medication.name,
    dosis: medication.dosage,
    stock: medication.stock,
    tipo_caja: medication.boxType ?? null,
    horarios: medication.times,
    etiqueta_frecuencia: medication.frequencyLabel,
    fecha_fin_tratamiento: medication.treatmentEndDate ?? null,
    color: medication.color,
    emoji: medication.emoji,
    activa: medication.active,
    ultima_toma_en: medication.lastTakenAt ?? null,
    dias_semana: medication.daysOfWeek ?? [],
    duracion_dias: medication.durationDays ?? null,
    fecha_inicio: medication.startDate ?? null,
  };
}

function medicationToSharedInsertLegacy(userId: string, medicationId: string, clientEmail: string, medication: Omit<Medication, "id">) {
  return {
    id: medicationId,
    creador_usuario_id: userId,
    cliente_email: clientEmail.trim().toLowerCase(),
    nombre: medication.name,
    dosis: medication.dosage,
    stock: medication.stock,
    tipo_caja: medication.boxType ?? null,
    horarios: medication.times,
    etiqueta_frecuencia: medication.frequencyLabel,
    fecha_fin_tratamiento: medication.treatmentEndDate ?? null,
    color: medication.color,
    emoji: medication.emoji,
    activa: medication.active,
    ultima_toma_en: medication.lastTakenAt ?? null,
  };
}

function medicationToUpdateEs(medication: Omit<Medication, "id">) {
  return {
    nombre: medication.name,
    dosis: medication.dosage,
    stock: medication.stock,
    tipo_caja: medication.boxType ?? null,
    horarios: medication.times,
    etiqueta_frecuencia: medication.frequencyLabel,
    fecha_fin_tratamiento: medication.treatmentEndDate ?? null,
    color: medication.color,
    emoji: medication.emoji,
    activa: medication.active,
    ultima_toma_en: medication.lastTakenAt ?? null,
    dias_semana: medication.daysOfWeek ?? [],
    duracion_dias: medication.durationDays ?? null,
    fecha_inicio: medication.startDate ?? null,
  };
}

function medicationToUpdateShared(medication: Omit<Medication, "id">, targetClientEmail?: string) {
  return {
    ...medicationToUpdateEs(medication),
    ...(targetClientEmail?.trim() ? { cliente_email: targetClientEmail.trim().toLowerCase() } : {}),
  };
}

function weekdayCode(date: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] ?? "mon";
}

function isMedicationAllowedOnDate(medication: { daysOfWeek?: string[]; durationDays?: number; startDate?: string }, date: Date): boolean {
  if (medication.daysOfWeek && medication.daysOfWeek.length > 0 && !medication.daysOfWeek.includes(weekdayCode(date))) {
    return false;
  }

  if (medication.startDate && medication.durationDays && medication.durationDays > 0) {
    const start = new Date(`${medication.startDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + medication.durationDays - 1);
    end.setHours(23, 59, 59, 999);
    if (date < start || date > end) {
      return false;
    }
  }

  return true;
}

function countScheduledDosesForDate(medication: { times: string[]; daysOfWeek?: string[]; durationDays?: number; startDate?: string }, date: Date): number {
  return isMedicationAllowedOnDate(medication, date) ? medication.times.length : 0;
}

function isSchemaColumnError(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("column") && (text.includes("does not exist") || text.includes("unknown"));
}

function mapSaveErrorToUserMessage(rawMessage: string): string {
  const text = rawMessage.toLowerCase();

  if (text.includes("failed to fetch") || text.includes("network") || text.includes("timeout")) {
    return "No hay conexión con Supabase en este momento.";
  }

  if (text.includes("row-level security") || text.includes("permission denied") || text.includes("not allowed")) {
    return "No tienes permisos para guardar este medicamento (RLS/GRANT).";
  }

  if (isSchemaColumnError(text)) {
    return "La base de datos tiene un esquema antiguo para medicación. Ejecuta los scripts de actualización de Supabase.";
  }

  return rawMessage || "No se pudo guardar el medicamento en Supabase.";
}

async function insertOwnMedicationWithFallback(userId: string, medicationId: string, medication: Omit<Medication, "id">): Promise<{ ok: boolean; errorMessage?: string }> {
  const { error } = await supabase
    .from(TABLE_NAME_ES)
    .insert(medicationToInsertEs(userId, medicationId, medication));

  if (!error) {
    return { ok: true };
  }

  if (isSchemaColumnError(error.message)) {
    const { error: legacyError } = await supabase
      .from(TABLE_NAME_ES)
      .insert(medicationToInsertEsLegacy(userId, medicationId, medication));

    if (!legacyError) {
      return { ok: true };
    }

    return { ok: false, errorMessage: legacyError.message };
  }

  return { ok: false, errorMessage: error.message };
}

async function insertSharedMedicationWithFallback(
  userId: string,
  medicationId: string,
  clientEmail: string,
  medication: Omit<Medication, "id">,
): Promise<{ ok: boolean; errorMessage?: string }> {
  const { error } = await supabase
    .from(SHARED_TABLE)
    .insert(medicationToSharedInsert(userId, medicationId, clientEmail, medication));

  if (!error) {
    return { ok: true };
  }

  if (isSchemaColumnError(error.message)) {
    const { error: legacyError } = await supabase
      .from(SHARED_TABLE)
      .insert(medicationToSharedInsertLegacy(userId, medicationId, clientEmail, medication));

    if (!legacyError) {
      return { ok: true };
    }

    return { ok: false, errorMessage: legacyError.message };
  }

  return { ok: false, errorMessage: error.message };
}

async function getCurrentUserContext(): Promise<AuthUserContext | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || !data.user.email) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
    role: String(data.user.user_metadata?.role ?? "usuario"),
  };
}

async function getAllFromTableEs(userId: string): Promise<Medication[] | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME_ES)
    .select("*")
    .eq("usuario_id", userId)
    .order("creado_en", { ascending: true });

  if (error || !data) {
    return null;
  }

  return (data as MedicationRowEs[]).map(rowEsToMedication);
}

async function getSharedForClient(clientEmail: string): Promise<Medication[] | null> {
  const { data, error } = await supabase
    .from(SHARED_TABLE)
    .select("*")
    .eq("cliente_email", clientEmail.toLowerCase())
    .eq("activa", true)
    .order("creado_en", { ascending: true });

  if (error || !data) {
    return null;
  }

  return (data as SharedMedicationRow[]).map((row) => sharedRowToMedication(row, true));
}

async function getSharedCreatedByCaregiver(userId: string): Promise<Medication[] | null> {
  const { data, error } = await supabase
    .from(SHARED_TABLE)
    .select("*")
    .eq("creador_usuario_id", userId)
    .eq("activa", true)
    .order("creado_en", { ascending: true });

  if (error || !data) {
    return null;
  }

  return (data as SharedMedicationRow[]).map((row) => sharedRowToMedication(row, false));
}

async function insertTakenLog(entry: {
  medicamento_id: string;
  creador_usuario_id?: string | null;
  cliente_email: string;
  nombre_medicamento: string;
  dosis: string;
  tomado_en: string;
  stock_restante: number;
  completado: boolean;
  registrado_por_email?: string | null;
}): Promise<void> {
  const { error } = await supabase.from(TAKEN_LOG_TABLE).insert(entry);
  if (error) {
    // Do not block marking as taken if logging table is missing or unavailable.
    return;
  }
}

async function getAllFromRemoteOrLocal(): Promise<Medication[]> {
  const user = await getCurrentUserContext();
  if (!user) {
    return getStoredMedications();
  }

  const ownRows = await getAllFromTableEs(user.id);
  if (ownRows === null) {
    return getStoredMedications();
  }

  const isClientRole = user.role === "usuario";
  const sharedRows = isClientRole
    ? await getSharedForClient(user.email)
    : await getSharedCreatedByCaregiver(user.id);

  if (sharedRows === null) {
    return getStoredMedications();
  }

  const combined = dedupeMedications([...ownRows, ...sharedRows]);

  // Keep local cache aligned with remote state, including when remote is empty.
  saveMedications(combined);
  return combined;
}

export const medicationService = {
  getAll(): Medication[] {
    return getStoredMedications();
  },

  async getAllAsync(): Promise<Medication[]> {
    return getAllFromRemoteOrLocal();
  },

  markAsTaken(id: string): Medication[] {
    const nowIso = new Date().toISOString();
    const updated = getStoredMedications().map((medication) =>
      medication.id === id ? { ...medication, lastTakenAt: nowIso, stock: Math.max(0, medication.stock - 1) } : medication,
    );
    saveMedications(updated);
    return updated;
  },

  async markAsTakenAsync(id: string): Promise<Medication[]> {
    const nowIso = new Date().toISOString();
    const user = await getCurrentUserContext();
    const todayTakenCountMap = await this.getTodayTakenCountMapAsync();

    if (id.startsWith("shared-")) {
      const sharedId = id.replace("shared-", "");
      if (!user) {
        return this.markAsTaken(id);
      }

      const { data: sharedMedication } = await supabase
        .from(SHARED_TABLE)
        .select("*")
        .eq("id", sharedId)
        .eq("cliente_email", user.email)
        .maybeSingle();

      const sharedRow = sharedMedication as {
        id?: string;
        creador_usuario_id?: string | null;
        cliente_email?: string;
        nombre?: string;
        dosis?: string;
        stock?: number;
        horarios?: string[];
        dias_semana?: string[] | null;
        duracion_dias?: number | null;
        fecha_inicio?: string | null;
      } | null;

      if (sharedRow && isMedicationObjectiveCompletedToday(sharedId, {
        times: sharedRow.horarios ?? [],
        daysOfWeek: sharedRow.dias_semana ?? undefined,
        durationDays: sharedRow.duracion_dias ?? undefined,
        startDate: sharedRow.fecha_inicio ?? undefined,
      }, todayTakenCountMap)) {
        return this.getAllAsync();
      }

      await insertTakenLog({
        medicamento_id: sharedId,
        creador_usuario_id: sharedRow?.creador_usuario_id ?? null,
        cliente_email: (sharedRow?.cliente_email ?? user.email).toLowerCase(),
        nombre_medicamento: sharedRow?.nombre ?? "Medicamento",
        dosis: sharedRow?.dosis ?? "",
        tomado_en: nowIso,
        stock_restante: Math.max(0, Number(sharedRow?.stock ?? 0) - 1),
        completado: true,
        registrado_por_email: user.email,
      });

      const nextStock = Math.max(0, Number(sharedRow?.stock ?? 0) - 1);
      const { error: sharedError } = await supabase
        .from(SHARED_TABLE)
        .update({ ultima_toma_en: nowIso, stock: nextStock })
        .eq("id", sharedId)
        .eq("cliente_email", user.email);

      if (!sharedError) {
        return this.getAllAsync();
      }

      return this.markAsTaken(id);
    }

    if (!user) {
      return this.markAsTaken(id);
    }

    const { data: ownMedication } = await supabase
      .from(TABLE_NAME_ES)
      .select("*")
      .eq("id", id)
      .eq("usuario_id", user.id)
      .maybeSingle();

    const ownRow = ownMedication as {
      id?: string;
      usuario_id?: string;
      nombre?: string;
      dosis?: string;
      stock?: number;
      horarios?: string[];
      dias_semana?: string[] | null;
      duracion_dias?: number | null;
      fecha_inicio?: string | null;
    } | null;

    if (ownRow && isMedicationObjectiveCompletedToday(id, {
      times: ownRow.horarios ?? [],
      daysOfWeek: ownRow.dias_semana ?? undefined,
      durationDays: ownRow.duracion_dias ?? undefined,
      startDate: ownRow.fecha_inicio ?? undefined,
    }, todayTakenCountMap)) {
      return this.getAllAsync();
    }

    await insertTakenLog({
      medicamento_id: id,
      creador_usuario_id: ownRow?.usuario_id ?? user.id,
      cliente_email: user.email.toLowerCase(),
      nombre_medicamento: ownRow?.nombre ?? "Medicamento",
      dosis: ownRow?.dosis ?? "",
      tomado_en: nowIso,
      stock_restante: Math.max(0, Number(ownRow?.stock ?? 0) - 1),
      completado: true,
      registrado_por_email: user.email,
    });

    const nextStock = Math.max(0, Number(ownRow?.stock ?? 0) - 1);
    const { error: esError } = await supabase
      .from(TABLE_NAME_ES)
      .update({ ultima_toma_en: nowIso, stock: nextStock })
      .eq("id", id)
      .eq("usuario_id", user.id);

    if (!esError) {
      return this.getAllAsync();
    }

    return this.markAsTaken(id);
  },

  add(medication: Medication): Medication[] {
    const updated = [...getStoredMedications(), medication];
    saveMedications(updated);
    return updated;
  },

  async addAsync(medication: Omit<Medication, "id">, targetClientEmail?: string): Promise<Medication[]> {
    const medicationId = generateMedicationId();
    const user = await getCurrentUserContext();
    if (!user) {
      return this.add({ ...medication, id: medicationId });
    }

    const ownResult = await insertOwnMedicationWithFallback(user.id, medicationId, medication);
    const insertedOwnMedication = ownResult.ok;
    let insertedSharedMedication = false;
    let sharedInsertError: string | null = null;

    if (targetClientEmail?.trim()) {
      const sharedResult = await insertSharedMedicationWithFallback(user.id, medicationId, targetClientEmail, medication);
      insertedSharedMedication = sharedResult.ok;
      sharedInsertError = sharedResult.errorMessage ?? null;

      if (!insertedSharedMedication) {
        if (insertedOwnMedication) {
          await supabase
            .from(TABLE_NAME_ES)
            .delete()
            .eq("id", medicationId)
            .eq("usuario_id", user.id);
        }
        throw new Error(mapSaveErrorToUserMessage(sharedInsertError ?? "No se pudo vincular el medicamento al cliente"));
      }
    }

    if (!insertedOwnMedication && !insertedSharedMedication) {
      throw new Error(mapSaveErrorToUserMessage(ownResult.errorMessage ?? "No se pudo guardar el medicamento"));
    }

    return this.getAllAsync();
  },

  update(id: string, medication: Omit<Medication, "id">): Medication[] {
    const baseId = normalizeMedicationId(id);
    const sharedId = `shared-${baseId}`;
    const updated = getStoredMedications().map((item) =>
      item.id === id || item.id === baseId || item.id === sharedId
        ? {
            ...item,
            ...medication,
            id: item.id,
          }
        : item,
    );
    saveMedications(updated);
    return updated;
  },

  async updateAsync(id: string, medication: Omit<Medication, "id">, targetClientEmail?: string): Promise<Medication[]> {
    const baseId = normalizeMedicationId(id);
    const user = await getCurrentUserContext();
    if (!user) {
      return this.update(id, medication);
    }

    const ownUpdate = await supabase
      .from(TABLE_NAME_ES)
      .update(medicationToUpdateEs(medication))
      .eq("id", baseId)
      .eq("usuario_id", user.id)
      .select("id");

    const sharedUpdate = await supabase
      .from(SHARED_TABLE)
      .update(medicationToUpdateShared(medication, targetClientEmail))
      .eq("id", baseId)
      .eq("creador_usuario_id", user.id)
      .select("id");

    const ownUpdated = !ownUpdate.error && (ownUpdate.data?.length ?? 0) > 0;
    const sharedUpdated = !sharedUpdate.error && (sharedUpdate.data?.length ?? 0) > 0;

    if (!ownUpdated && !sharedUpdated) {
      throw new Error("No se pudo editar el medicamento.");
    }

    return this.getAllAsync();
  },

  remove(id: string): Medication[] {
    const updated = removeByPossibleIds(getStoredMedications(), id);
    saveMedications(updated);
    return updated;
  },

  async removeAsync(id: string): Promise<Medication[]> {
    const baseId = normalizeMedicationId(id);
    const user = await getCurrentUserContext();
    if (!user) {
      return this.remove(id);
    }

    const sharedDelete = await supabase
      .from(SHARED_TABLE)
      .delete()
      .eq("id", baseId)
      .eq("creador_usuario_id", user.id)
      .select("id");

    const sharedDeleted = !sharedDelete.error && (sharedDelete.data?.length ?? 0) > 0;

    let sharedArchived = false;
    if (!sharedDeleted) {
      const sharedArchive = await supabase
        .from(SHARED_TABLE)
        .update({ activa: false })
        .eq("id", baseId)
        .eq("creador_usuario_id", user.id)
        .select("id");

      sharedArchived = !sharedArchive.error && (sharedArchive.data?.length ?? 0) > 0;
    }

    const ownDelete = await supabase
      .from(TABLE_NAME_ES)
      .delete()
      .eq("id", baseId)
      .eq("usuario_id", user.id)
      .select("id");

    const ownDeleted = !ownDelete.error && (ownDelete.data?.length ?? 0) > 0;

    if (sharedDeleted || sharedArchived || ownDeleted) {
      return this.getAllAsync();
    }

    return this.remove(id);
  },

  async getTodayTakenCountMapAsync(): Promise<Record<string, number>> {
    const user = await getCurrentUserContext();
    if (!user) {
      return {};
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const isClientRole = user.role === "usuario";

    const baseQuery = supabase
      .from(TAKEN_LOG_TABLE)
      .select("medicamento_id")
      .gte("tomado_en", start.toISOString())
      .lt("tomado_en", end.toISOString());

    const query = isClientRole
      ? baseQuery.eq("cliente_email", user.email)
      : baseQuery.eq("creador_usuario_id", user.id);

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    return (data as Array<{ medicamento_id: string }>).reduce<Record<string, number>>((acc, row) => {
      acc[row.medicamento_id] = (acc[row.medicamento_id] ?? 0) + 1;
      return acc;
    }, {});
  },

  async getTakenLogsForMonthAsync(year: number, monthIndex: number): Promise<MedicationTakenLog[]> {
    const user = await getCurrentUserContext();
    if (!user) {
      return [];
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 1);
    const isClientRole = user.role === "usuario";

    const baseQuery = supabase
      .from(TAKEN_LOG_TABLE)
      .select("medicamento_id, nombre_medicamento, dosis, tomado_en, stock_restante, completado, registrado_por_email")
      .gte("tomado_en", start.toISOString())
      .lt("tomado_en", end.toISOString())
      .order("tomado_en", { ascending: true });

    const query = isClientRole
      ? baseQuery.eq("cliente_email", user.email)
      : baseQuery.eq("creador_usuario_id", user.id);

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return (data as Array<{
      medicamento_id: string;
      nombre_medicamento: string;
      dosis: string;
      tomado_en: string;
      stock_restante: number;
      completado: boolean;
      registrado_por_email?: string | null;
    }>).map((row) => ({
      medicationId: row.medicamento_id,
      medicationName: row.nombre_medicamento,
      dosage: row.dosis,
      takenAt: row.tomado_en,
      stockRemaining: row.stock_restante,
      completed: row.completado,
      recordedByEmail: row.registrado_por_email ?? null,
    }));
  },
};
