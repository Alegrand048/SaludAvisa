import { supabase } from "./supabaseClient";

const GROUP_TABLE = "grupos_familiares";
const MEMBER_TABLE = "miembros_familia";
const INVITATION_TABLE = "invitaciones_familia";
const JOIN_REQUEST_TABLE = "solicitudes_union_familiar";
const SHARED_MEDICATIONS_TABLE = "medicamentos_familia_compartidos";
const SHARED_APPOINTMENTS_TABLE = "citas_familia_compartidas";

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

export interface MemberProfileSummary {
  name?: string;
  avatarUrl?: string;
}

type AppUserRole = "usuario" | "familiar_cuidador";

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

function isAvatarUrlCandidate(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("data:image") || trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

function resolveAvatarFromProfileRow(row: ProfileNameRow): string | undefined {
  if (isAvatarUrlCandidate(row.avatar_url)) {
    return row.avatar_url!.trim();
  }
  if (isAvatarUrlCandidate(row.avatar_emoji)) {
    return row.avatar_emoji!.trim();
  }
  return undefined;
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
    .or(`cliente_email.eq.${normalizedEmail},solicitante_usuario_id.eq.${userId},solicitante_email.eq.${normalizedEmail}`)
    .order("creado_en", { ascending: false });

  if (error || !data || data.length === 0) {
    return null;
  }

  const rows = data as JoinRequestRow[];
  const latest = rows[0];

  const ownerEmail = normalizeEmail(latest.cliente_email);

  // Accepted requests are historical records and can stay as "aceptada"
  // after a caregiver unlinks. To avoid stale family resurrection on caregiver
  // accounts, only allow this fallback for the client/owner side.
  if (normalizedEmail !== ownerEmail) {
    return null;
  }

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

async function getFallbackGroupFromSharedResources(userId: string, userEmail: string): Promise<FamilyGroup | null> {
  const normalizedEmail = normalizeEmail(userEmail);

  const [sharedMedicationsResult, sharedAppointmentsResult] = await Promise.all([
    supabase
      .from(SHARED_MEDICATIONS_TABLE)
      .select("cliente_email")
      .eq("creador_usuario_id", userId)
      .eq("activa", true),
    supabase
      .from(SHARED_APPOINTMENTS_TABLE)
      .select("cliente_email")
      .eq("creador_usuario_id", userId)
      .eq("activa", true),
  ]);

  const sharedClientEmails = new Set<string>();
  if (!sharedMedicationsResult.error && sharedMedicationsResult.data) {
    (sharedMedicationsResult.data as Array<{ cliente_email: string }>).forEach((row) => {
      if (row.cliente_email) {
        sharedClientEmails.add(normalizeEmail(row.cliente_email));
      }
    });
  }
  if (!sharedAppointmentsResult.error && sharedAppointmentsResult.data) {
    (sharedAppointmentsResult.data as Array<{ cliente_email: string }>).forEach((row) => {
      if (row.cliente_email) {
        sharedClientEmails.add(normalizeEmail(row.cliente_email));
      }
    });
  }

  const ownerEmail = Array.from(sharedClientEmails)[0];
  if (!ownerEmail) {
    return null;
  }

  const members: MiembroFamiliar[] = [
    {
      email: ownerEmail,
      role: "cliente",
      status: "activo",
    },
    {
      email: normalizedEmail,
      role: "familiar_cuidador",
      status: "activo",
    },
  ];

  return {
    id: `fallback-shared-${userId}`,
    ownerId: ownerEmail === normalizedEmail ? userId : userId,
    ownerEmail,
    createdAt: new Date().toISOString(),
    members,
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

async function getByMemberUserId(userId: string): Promise<FamilyGroup | null> {
  const { data: activeData, error: activeError } = await supabase
    .from(MEMBER_TABLE)
    .select("grupo_id")
    .eq("usuario_id", userId)
    .eq("estado", "activo")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeError && activeData?.grupo_id) {
    return loadGroupById(activeData.grupo_id);
  }

  const { data: invitedData, error: invitedError } = await supabase
    .from(MEMBER_TABLE)
    .select("grupo_id")
    .eq("usuario_id", userId)
    .eq("estado", "invitado")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invitedError || !invitedData?.grupo_id) {
    return null;
  }

  return loadGroupById(invitedData.grupo_id);
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

    // First try active memberships. This prevents selecting an old invited row
    // and is resilient to historic rows with inconsistent email casing.
    const { data: activeData, error: activeError } = await supabase
      .from(MEMBER_TABLE)
      .select("grupo_id")
      .ilike("email", normalized)
      .eq("estado", "activo")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeError && activeData?.grupo_id) {
      return loadGroupById(activeData.grupo_id);
    }

    const { data: invitedData, error: invitedError } = await supabase
      .from(MEMBER_TABLE)
      .select("grupo_id")
      .ilike("email", normalized)
      .eq("estado", "invitado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invitedError || !invitedData?.grupo_id) {
      return null;
    }

    return loadGroupById(invitedData.grupo_id);
  },

  async getForUser(userId: string, userEmail: string, userRole?: AppUserRole): Promise<FamilyGroup | null> {
    const ownerGroup = await this.getByOwner(userId);
    if (ownerGroup) {
      return ownerGroup;
    }

    const memberGroupByUserId = await getByMemberUserId(userId);
    if (memberGroupByUserId) {
      return memberGroupByUserId;
    }

    const memberGroup = await this.getByMemberEmail(userEmail);
    if (memberGroup) {
      return memberGroup;
    }

    // Caregiver view should avoid accepted-request history, but still recover
    // family linkage from currently active shared resources.
    if (userRole === "familiar_cuidador") {
      return getFallbackGroupFromSharedResources(userId, userEmail);
    }

    const acceptedRequestFallback = await getFallbackGroupFromAcceptedRequests(userId, userEmail);
    if (acceptedRequestFallback) {
      return acceptedRequestFallback;
    }

    return getFallbackGroupFromSharedResources(userId, userEmail);
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
      .in("estado", ["pendiente", "aceptada"]);

    if (!requestError && requestRows) {
      (requestRows as Array<Pick<JoinRequestRow, "solicitante_email" | "solicitante_nombre" | "cliente_email" | "estado">>).forEach((row) => {
        const requesterEmail = normalizeEmail(row.solicitante_email);
        const clientEmail = normalizeEmail(row.cliente_email);
        
        // If caregiver (requester) is in unique emails and has a name, map it.
        if (uniqueEmails.includes(requesterEmail) && row.solicitante_nombre?.trim()) {
          namesByEmail[requesterEmail] = row.solicitante_nombre.trim();
        }
        
        // If client email is in unique emails and we're a caregiver viewing them, fallback using solicitante_nombre convention
        // This gives us the caregiver's stored name which is likely more accurate than email.
        const normalizedUserEmail = normalizeEmail(userEmail);
        if (uniqueEmails.includes(clientEmail) && normalizedUserEmail === requesterEmail && row.solicitante_nombre?.trim()) {
          // If the user is the requester, we can infer the client is the other party
          // Try to use the profile first, which was queried above
          if (!namesByEmail[clientEmail]) {
            // Fallback to showing the user's profile name for the client if no direct profile data
            // This is handled later in resolveMemberDisplayName
          }
        }
      });
    }

    return namesByEmail;
  },

  async getMemberProfiles(memberEmails: string[], userEmail: string): Promise<Record<string, MemberProfileSummary>> {
    const uniqueEmails = Array.from(new Set(memberEmails.map(normalizeEmail).filter(Boolean)));
    if (uniqueEmails.length === 0) {
      return {};
    }

    const byEmail: Record<string, MemberProfileSummary> = {};

    const { data: requestRows, error: requestError } = await supabase
      .from(JOIN_REQUEST_TABLE)
      .select("solicitante_email, solicitante_nombre, cliente_email, estado")
      .in("estado", ["pendiente", "aceptada"])
      .or(`cliente_email.eq.${normalizeEmail(userEmail)},solicitante_email.eq.${normalizeEmail(userEmail)}`);

    if (!requestError && requestRows) {
      (requestRows as Array<Pick<JoinRequestRow, "solicitante_email" | "solicitante_nombre" | "cliente_email" | "estado">>).forEach((row) => {
        const requesterEmail = normalizeEmail(row.solicitante_email);
        if (uniqueEmails.includes(requesterEmail) && row.solicitante_nombre?.trim()) {
          byEmail[requesterEmail] = {
            ...(byEmail[requesterEmail] ?? {}),
            name: byEmail[requesterEmail]?.name || row.solicitante_nombre.trim(),
          };
        }
      });
    }

     const { data: rpcRows, error: rpcError } = await supabase.rpc("api_obtener_perfiles_grupo_familiar", {
       p_emails: uniqueEmails,
     });

    if (!rpcError && Array.isArray(rpcRows)) {
      (rpcRows as Array<{ email: string; nombre_completo: string | null; avatar_url: string | null }>).forEach((row) => {
        const email = normalizeEmail(row.email);
        byEmail[email] = {
          name: row.nombre_completo?.trim() || byEmail[email]?.name,
          avatarUrl: row.avatar_url?.trim() || byEmail[email]?.avatarUrl,
        };
      });
    }

    return byEmail;
  },

  async getProfileName(email: string): Promise<string | null> {
     const { data, error } = await supabase.rpc("api_obtener_perfiles_grupo_familiar", {
       p_emails: [email],
     });

    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const row = data[0] as { nombre_completo?: string | null };
    return row.nombre_completo?.trim() || null;
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
