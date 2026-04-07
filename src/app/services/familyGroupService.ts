import { supabase } from "./supabaseClient";

const GROUP_TABLE = "grupos_familiares";
const MEMBER_TABLE = "miembros_familia";
const INVITATION_TABLE = "invitaciones_familia";
const JOIN_REQUEST_TABLE = "solicitudes_union_familiar";

export type RolFamiliar = "cliente" | "familiar_cuidador";

type RolFamiliarLegacy = RolFamiliar | "cuidador_familiar";

interface FamilyGroupRow {
  id: string;
  propietario_id: string;
  propietario_email: string;
  creado_en: string;
}

interface FamilyMemberRow {
  email: string;
  rol: RolFamiliarLegacy;
  estado: "invitado" | "activo";
}

interface FamilyInvitationRow {
  token: string;
}

export interface MiembroFamiliar {
  email: string;
  role: RolFamiliar;
  status: "invitado" | "activo";
}

export interface FamilyGroup {
  id: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  members: MiembroFamiliar[];
}

export interface JoinRequest {
  id: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  clientEmail: string;
  status: "pendiente" | "aceptada" | "rechazada";
  createdAt: string;
}

interface JoinRequestRow {
  id: string;
  solicitante_usuario_id: string;
  solicitante_email: string;
  solicitante_nombre: string;
  cliente_email: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  creado_en: string;
}

interface ProfileNameRow {
  email: string;
  nombre_completo: string | null;
}

interface FamilyMember {
  email: string;
  role: RolFamiliar;
  status: "invitado" | "activo";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeMemberRole(role: RolFamiliarLegacy): RolFamiliar {
  return role === "cuidador_familiar" ? "familiar_cuidador" : role;
}

function mapGroup(row: FamilyGroupRow, members: FamilyMemberRow[]): FamilyGroup {
  const ownerEmail = normalizeEmail(row.propietario_email);
  const normalizedMembers: FamilyMember[] = members.map((member) => ({
    email: normalizeEmail(member.email),
    role: normalizeMemberRole(member.rol),
    status: member.estado,
  }));

  // Ensure the client owner is always represented in the resolved group.
  if (!normalizedMembers.some((member) => member.email === ownerEmail)) {
    normalizedMembers.unshift({
      email: ownerEmail,
      role: "cliente",
      status: "activo",
    });
  }

  return {
    id: row.id,
    ownerId: row.propietario_id,
    ownerEmail,
    createdAt: row.creado_en,
    members: normalizedMembers,
  };
}

function mapJoinRequest(row: JoinRequestRow): JoinRequest {
  return {
    id: row.id,
    requesterUserId: row.solicitante_usuario_id,
    requesterEmail: normalizeEmail(row.solicitante_email),
    requesterName: row.solicitante_nombre,
    clientEmail: normalizeEmail(row.cliente_email),
    status: row.estado,
    createdAt: row.creado_en,
  };
}

async function getFallbackGroupFromAcceptedRequests(userId: string, userEmail: string): Promise<FamilyGroup | null> {
  const normalizedEmail = normalizeEmail(userEmail);

  const { data, error } = await supabase
    .from(JOIN_REQUEST_TABLE)
    .select("id, solicitante_usuario_id, solicitante_email, solicitante_nombre, cliente_email, estado, creado_en")
    .eq("estado", "aceptada")
    .or(`cliente_email.eq.${normalizedEmail},solicitante_usuario_id.eq.${userId}`)
    .order("creado_en", { ascending: false });

  if (error || !data || data.length === 0) {
    return null;
  }

  const rows = data as JoinRequestRow[];
  const latest = rows[0];

  const ownerEmail = normalizeEmail(latest.cliente_email);
  const relatedRows = rows.filter((row) => normalizeEmail(row.cliente_email) === ownerEmail);

  const members: MiembroFamiliar[] = [
    {
      email: ownerEmail,
      role: "cliente",
      status: "activo",
    },
    ...relatedRows.map((row) => ({
      email: normalizeEmail(row.solicitante_email),
      role: "familiar_cuidador" as const,
      status: "activo" as const,
    })),
  ];

  const deduped = Array.from(new Map(members.map((member) => [member.email, member])).values());

  return {
    id: `fallback-${latest.id}`,
    ownerId: normalizedEmail === ownerEmail ? userId : latest.solicitante_usuario_id,
    ownerEmail,
    createdAt: latest.creado_en,
    members: deduped,
  };
}

async function loadMembersByGroupId(groupId: string): Promise<FamilyMemberRow[]> {
  const { data, error } = await supabase
    .from(MEMBER_TABLE)
    .select("email, rol, estado")
    .eq("grupo_id", groupId)
    .order("creado_en", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as FamilyMemberRow[];
}

async function loadGroupById(groupId: string): Promise<FamilyGroup | null> {
  const { data, error } = await supabase
    .from(GROUP_TABLE)
    .select("id, propietario_id, propietario_email, creado_en")
    .eq("id", groupId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const members = await loadMembersByGroupId(data.id);
  return mapGroup(data as FamilyGroupRow, members);
}

export const familyGroupService = {
  async getByOwner(ownerId: string): Promise<FamilyGroup | null> {
    const { data, error } = await supabase
      .from(GROUP_TABLE)
      .select("id, propietario_id, propietario_email, creado_en")
      .eq("propietario_id", ownerId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const members = await loadMembersByGroupId(data.id);
    return mapGroup(data as FamilyGroupRow, members);
  },

  async getByMemberEmail(email: string): Promise<FamilyGroup | null> {
    const normalized = normalizeEmail(email);

    const { data, error } = await supabase
      .from(MEMBER_TABLE)
      .select("grupo_id")
      .eq("email", normalized)
      .in("estado", ["invitado", "activo"])
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.grupo_id) {
      return null;
    }

    return loadGroupById(data.grupo_id);
  },

  async getForUser(userId: string, userEmail: string): Promise<FamilyGroup | null> {
    const ownerGroup = await this.getByOwner(userId);
    if (ownerGroup) {
      return ownerGroup;
    }

    const memberGroup = await this.getByMemberEmail(userEmail);
    if (memberGroup) {
      return memberGroup;
    }

    return getFallbackGroupFromAcceptedRequests(userId, userEmail);
  },

  async acceptPendingInvitations(userId: string, email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);

    const { data, error } = await supabase
      .from(INVITATION_TABLE)
      .select("token")
      .eq("email_invitado", normalizedEmail)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: true });

    if (error || !data || data.length === 0) {
      return;
    }

    for (const invitation of data as FamilyInvitationRow[]) {
      await supabase.rpc("api_aceptar_invitacion_familiar", {
        p_token: invitation.token,
        p_user_id: userId,
        p_email: normalizedEmail,
      });
    }
  },

  async createJoinRequest(requesterUserId: string, requesterEmail: string, clientEmail: string, requesterName: string): Promise<void> {
    const requester = normalizeEmail(requesterEmail);
    const client = normalizeEmail(clientEmail);
    if (!client || !requester) {
      throw new Error("Debes indicar los correos correctamente.");
    }
    if (requester === client) {
      throw new Error("No puedes enviarte una solicitud a ti mismo.");
    }

    const { error } = await supabase.from(JOIN_REQUEST_TABLE).insert({
      solicitante_usuario_id: requesterUserId,
      solicitante_email: requester,
      solicitante_nombre: requesterName.trim() || "Familiar/Cuidador",
      cliente_email: client,
      estado: "pendiente",
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async getPendingJoinRequestsForClient(clientEmail: string): Promise<JoinRequest[]> {
    const { data, error } = await supabase
      .from(JOIN_REQUEST_TABLE)
      .select("id, solicitante_usuario_id, solicitante_email, solicitante_nombre, cliente_email, estado, creado_en")
      .eq("cliente_email", normalizeEmail(clientEmail))
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: true });

    if (error || !data) {
      return [];
    }

    return (data as JoinRequestRow[]).map(mapJoinRequest);
  },

  async getMemberDisplayNames(memberEmails: string[], userEmail: string): Promise<Record<string, string>> {
    const uniqueEmails = Array.from(new Set(memberEmails.map(normalizeEmail).filter(Boolean)));
    if (uniqueEmails.length === 0) {
      return {};
    }

    const namesByEmail: Record<string, string> = {};

    // Best effort: if RLS allows it, read names directly from profiles.
    const { data: profileRows, error: profileError } = await supabase
      .from("perfiles")
      .select("email, nombre_completo")
      .in("email", uniqueEmails);

    if (!profileError && profileRows) {
      (profileRows as ProfileNameRow[]).forEach((row) => {
        const normalized = normalizeEmail(row.email);
        if (row.nombre_completo?.trim()) {
          namesByEmail[normalized] = row.nombre_completo.trim();
        }
      });
    }

    // Fallback for family mode when profile names are not readable by RLS.
    const { data: requestRows, error: requestError } = await supabase
      .from(JOIN_REQUEST_TABLE)
      .select("solicitante_email, solicitante_nombre, cliente_email, estado")
      .in("estado", ["pendiente", "aceptada"])
      .or(`cliente_email.eq.${normalizeEmail(userEmail)},solicitante_email.eq.${normalizeEmail(userEmail)}`);

    if (!requestError && requestRows) {
      (requestRows as Array<Pick<JoinRequestRow, "solicitante_email" | "solicitante_nombre" | "cliente_email" | "estado">>).forEach((row) => {
        const requesterEmail = normalizeEmail(row.solicitante_email);
        if (uniqueEmails.includes(requesterEmail) && row.solicitante_nombre?.trim()) {
          namesByEmail[requesterEmail] = row.solicitante_nombre.trim();
        }
      });
    }

    return namesByEmail;
  },

  async acceptJoinRequest(clientUserId: string, clientEmail: string, requestId: string): Promise<void> {
    const { error } = await supabase.rpc("api_aceptar_solicitud_union_familiar", {
      p_cliente_id: clientUserId,
      p_cliente_email: normalizeEmail(clientEmail),
      p_solicitud_id: requestId,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async rejectJoinRequest(clientUserId: string, clientEmail: string, requestId: string): Promise<void> {
    const { error } = await supabase
      .from(JOIN_REQUEST_TABLE)
      .update({ estado: "rechazada" })
      .eq("id", requestId)
      .eq("cliente_email", normalizeEmail(clientEmail));

    if (error) {
      throw new Error(error.message);
    }

    void clientUserId;
  },

  async leaveGroup(userId: string, userEmail: string): Promise<void> {
    const { error } = await supabase.rpc("api_salir_grupo_familiar", {
      p_user_id: userId,
      p_email_miembro: normalizeEmail(userEmail),
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async createGroup(ownerId: string, ownerEmail: string, familyPassword: string): Promise<FamilyGroup> {
    if (familyPassword.trim().length < 4) {
      throw new Error("La contrasena familiar debe tener al menos 4 caracteres.");
    }

    const { error } = await supabase.rpc("api_crear_grupo_familiar", {
      p_owner_id: ownerId,
      p_owner_email: normalizeEmail(ownerEmail),
      p_contrasena_familiar: familyPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    const refreshed = await this.getByOwner(ownerId);
    if (!refreshed) {
      throw new Error("No se pudo recuperar el grupo tras crearlo.");
    }

    return refreshed;
  },

  async inviteClient(ownerId: string, clientEmail: string, familyPassword: string): Promise<FamilyGroup> {
    const normalizedEmail = normalizeEmail(clientEmail);

    const { error } = await supabase.rpc("api_crear_invitacion_familiar", {
      p_owner_id: ownerId,
      p_email_invitado: normalizedEmail,
      p_rol: "cliente",
      p_contrasena_familiar: familyPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    const refreshed = await this.getByOwner(ownerId);
    if (!refreshed) {
      throw new Error("No se pudo recuperar el grupo tras invitar.");
    }

    return refreshed;
  },

  async changeMemberRole(ownerId: string, memberEmail: string, newRole: RolFamiliar, familyPassword: string): Promise<FamilyGroup> {
    const { error } = await supabase.rpc("api_cambiar_rol_miembro_familiar", {
      p_owner_id: ownerId,
      p_email_miembro: normalizeEmail(memberEmail),
      p_nuevo_rol: newRole,
      p_contrasena_familiar: familyPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    const refreshed = await this.getByOwner(ownerId);
    if (!refreshed) {
      throw new Error("No se pudo recuperar el grupo tras cambiar rol.");
    }

    return refreshed;
  },

  async removeMember(ownerId: string, memberEmail: string, familyPassword: string): Promise<FamilyGroup> {
    const { error } = await supabase.rpc("api_expulsar_miembro_familiar", {
      p_owner_id: ownerId,
      p_email_miembro: normalizeEmail(memberEmail),
      p_contrasena_familiar: familyPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    const refreshed = await this.getByOwner(ownerId);
    if (!refreshed) {
      throw new Error("No se pudo recuperar el grupo tras expulsar.");
    }

    return refreshed;
  },
};
