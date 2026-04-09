import { Appointment } from "../models/appointment";
import { readFromStorage, writeToStorage } from "./storage";
import { supabase } from "./supabaseClient";

const CLAVE_ALMACENAMIENTO = "saludavisa.appointments";
const SHARED_TABLE = "citas_familia_compartidas";
const APPOINTMENT_VISIBLE_AFTER_MINUTES = 24 * 60;
const LEGACY_DEMO_APPOINTMENT_IDS = new Set(["1", "2", "3"]);
const LEGACY_DEMO_APPOINTMENT_SPECIALTIES = new Set([
  "cardiologia",
  "oftalmologia",
  "traumatologia",
]);

interface SharedAppointmentRow {
  id: string;
  creador_usuario_id: string;
  cliente_email: string;
  especialidad: string;
  fecha_hora: string;
  ubicacion: string;
  medico: string;
  emoji: string;
  color: string;
  activa: boolean;
}

interface AuthUserContext {
  id: string;
  email: string;
  role: string;
}

const citasSemilla: Appointment[] = [];

function isLegacyDemoAppointment(cita: Appointment): boolean {
  return (
    LEGACY_DEMO_APPOINTMENT_IDS.has(cita.id) ||
    LEGACY_DEMO_APPOINTMENT_SPECIALTIES.has(cita.specialty.trim().toLowerCase())
  );
}

function obtenerCitasAlmacenadas(): Appointment[] {
  const loaded = readFromStorage<Appointment[]>(CLAVE_ALMACENAMIENTO, citasSemilla);
  const cleaned = loaded.filter((cita) => !isLegacyDemoAppointment(cita));

  if (cleaned.length !== loaded.length) {
    writeToStorage(CLAVE_ALMACENAMIENTO, cleaned);
  }

  return cleaned.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

function guardarCitas(citas: Appointment[]): void {
  writeToStorage(CLAVE_ALMACENAMIENTO, citas);
}

function obtenerCitasLocales(): Appointment[] {
  return obtenerCitasAlmacenadas().filter((cita) => !cita.id.startsWith("shared-"));
}

function dedupeAppointments(items: Appointment[]): Appointment[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function filterAppointmentsWithinVisibilityWindow(items: Appointment[], now: Date = new Date()): Appointment[] {
  const minDate = new Date(now.getTime() - APPOINTMENT_VISIBLE_AFTER_MINUTES * 60000);
  return items
    .filter((appointment) => new Date(appointment.dateTime) >= minDate)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

function rowToAppointment(row: SharedAppointmentRow): Appointment {
  return {
    id: `shared-${row.id}`,
    specialty: row.especialidad,
    dateTime: row.fecha_hora,
    location: row.ubicacion,
    doctor: row.medico,
    emoji: row.emoji,
    color: row.color,
  };
}

function appointmentToSharedInsert(userId: string, clientEmail: string, appointment: Omit<Appointment, "id">) {
  return {
    creador_usuario_id: userId,
    cliente_email: clientEmail.trim().toLowerCase(),
    especialidad: appointment.specialty,
    fecha_hora: appointment.dateTime,
    ubicacion: appointment.location,
    medico: appointment.doctor,
    emoji: appointment.emoji,
    color: appointment.color,
    activa: true,
  };
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

async function getSharedForClient(clientEmail: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from(SHARED_TABLE)
    .select("id, cliente_email, especialidad, fecha_hora, ubicacion, medico, emoji, color, activa")
    .eq("cliente_email", clientEmail.toLowerCase())
    .eq("activa", true)
    .order("fecha_hora", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as SharedAppointmentRow[]).map(rowToAppointment);
}

async function getSharedCreatedByUser(userId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from(SHARED_TABLE)
    .select("id, creador_usuario_id, cliente_email, especialidad, fecha_hora, ubicacion, medico, emoji, color, activa")
    .eq("creador_usuario_id", userId)
    .eq("activa", true)
    .order("fecha_hora", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as SharedAppointmentRow[]).map(rowToAppointment);
}

async function getAllFromRemoteOrLocal(): Promise<Appointment[]> {
  const user = await getCurrentUserContext();
  if (!user) {
    return obtenerCitasLocales();
  }

  const isClientRole = user.role === "usuario";
  const sharedRows = isClientRole ? await getSharedForClient(user.email) : await getSharedCreatedByUser(user.id);
  const localRows = obtenerCitasLocales();
  const combined = dedupeAppointments([...localRows, ...sharedRows]);

  if (localRows.length !== obtenerCitasAlmacenadas().length) {
    guardarCitas(localRows);
  }

  return filterAppointmentsWithinVisibilityWindow(combined);
}

export const servicioCitas = {
  obtenerTodas(): Appointment[] {
    return filterAppointmentsWithinVisibilityWindow(obtenerCitasLocales());
  },

  obtenerProxima(ahora: Date = new Date()): Appointment | null {
    return filterAppointmentsWithinVisibilityWindow(obtenerCitasLocales(), ahora).find((cita) => new Date(cita.dateTime) >= ahora) ?? null;
  },

  agregar(cita: Appointment): Appointment[] {
    const actualizadas = [...obtenerCitasLocales(), cita].sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    );
    guardarCitas(actualizadas);
    return actualizadas;
  },

  eliminar(id: string): Appointment[] {
    const actualizadas = obtenerCitasLocales().filter((cita) => cita.id !== id);
    guardarCitas(actualizadas);
    return actualizadas;
  },

  async obtenerTodasAsync(): Promise<Appointment[]> {
    return getAllFromRemoteOrLocal();
  },

  async agregarAsync(cita: Omit<Appointment, "id">, targetClientEmail?: string): Promise<Appointment[]> {
    const crearLocal = () => {
      const local: Appointment = {
        ...cita,
        id: crypto.randomUUID(),
      };
      return servicioCitas.agregar(local);
    };

    if (!targetClientEmail?.trim()) {
      return crearLocal();
    }

    const user = await getCurrentUserContext();
    if (!user) {
      return crearLocal();
    }

    const { error } = await supabase
      .from(SHARED_TABLE)
      .insert(appointmentToSharedInsert(user.id, targetClientEmail, cita));

    if (error) {
      return crearLocal();
    }

    return getAllFromRemoteOrLocal();
  },

  async actualizarAsync(id: string, updates: Partial<Omit<Appointment, "id">>): Promise<Appointment[]> {
    const isShared = id.startsWith("shared-");
    
    if (isShared) {
      // Update in Supabase
      const sharedId = id.replace("shared-", "");
      const updatePayload: Record<string, unknown> = {
        actualizado_en: new Date().toISOString(),
      };
      
      if (updates.specialty !== undefined) updatePayload.especialidad = updates.specialty;
      if (updates.dateTime !== undefined) updatePayload.fecha_hora = updates.dateTime;
      if (updates.location !== undefined) updatePayload.ubicacion = updates.location;
      if (updates.doctor !== undefined) updatePayload.medico = updates.doctor;
      
      const { error } = await supabase
        .from(SHARED_TABLE)
        .update(updatePayload)
        .eq("id", sharedId);
      
      if (error) {
        console.error("Error updating shared appointment:", error);
        throw new Error(`No se pudo actualizar la cita: ${error.message}`);
      }
    } else {
      // Update in local storage
      const actualizadas = obtenerCitasLocales().map((cita) =>
        cita.id === id ? { ...cita, ...updates } : cita
      );
      guardarCitas(actualizadas);
    }
    
    return getAllFromRemoteOrLocal();
  },

  async eliminarAsync(id: string): Promise<Appointment[]> {
    const isShared = id.startsWith("shared-");
    
    if (isShared) {
      // Mark as inactive in Supabase
      const sharedId = id.replace("shared-", "");
      const { error } = await supabase
        .from(SHARED_TABLE)
        .update({ 
          activa: false,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", sharedId);
      
      if (error) {
        console.error("Error deleting shared appointment:", error);
        throw new Error(`No se pudo eliminar la cita: ${error.message}`);
      }
    } else {
      // Delete from local storage
      const actualizadas = obtenerCitasLocales().filter((cita) => cita.id !== id);
      guardarCitas(actualizadas);
    }
    
    return getAllFromRemoteOrLocal();
  },
};

export const appointmentService = {
  getAll: servicioCitas.obtenerTodas,
  getNext: servicioCitas.obtenerProxima,
  add: servicioCitas.agregar,
  remove: servicioCitas.eliminar,
  getAllAsync: servicioCitas.obtenerTodasAsync,
  addAsync: servicioCitas.agregarAsync,
  updateAsync: servicioCitas.actualizarAsync,
  deleteAsync: servicioCitas.eliminarAsync,
};
