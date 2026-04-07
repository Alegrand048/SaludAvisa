import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
const app = new Hono();

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9380b593/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/make-server-9380b593/cuenta/eliminar", async (c) => {
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return c.json({ error: "Token no proporcionado" }, 401);
  }

  const verifier = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await verifier.auth.getUser();

  if (userError || !user) {
    return c.json({ error: "Token invalido o sesion expirada" }, 401);
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ ok: true });
});

app.post("/make-server-9380b593/familia/crear-grupo", async (c) => {
  const body = await c.req.json();
  const ownerId = body.ownerId as string;
  const ownerEmail = body.ownerEmail as string;
  const contrasenaFamiliar = body.contrasenaFamiliar as string;

  if (!ownerId || !ownerEmail || !contrasenaFamiliar) {
    return c.json({ error: "Faltan ownerId, ownerEmail o contrasenaFamiliar" }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc("api_crear_grupo_familiar", {
    p_owner_id: ownerId,
    p_owner_email: ownerEmail,
    p_contrasena_familiar: contrasenaFamiliar,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ grupoId: data });
});

app.post("/make-server-9380b593/invitaciones/crear", async (c) => {
  const body = await c.req.json();
  const ownerId = body.ownerId as string;
  const emailInvitado = body.emailInvitado as string;
  const rol = body.rol as string;
  const contrasenaFamiliar = body.contrasenaFamiliar as string;

  if (!ownerId || !emailInvitado || !rol || !contrasenaFamiliar) {
    return c.json({ error: "Faltan ownerId, emailInvitado, rol o contrasenaFamiliar" }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc("api_crear_invitacion_familiar", {
    p_owner_id: ownerId,
    p_email_invitado: emailInvitado,
    p_rol: rol,
    p_contrasena_familiar: contrasenaFamiliar,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ invitacion: data?.[0] ?? null });
});

app.post("/make-server-9380b593/invitaciones/aceptar", async (c) => {
  const body = await c.req.json();
  const token = body.token as string;
  const userId = body.userId as string;
  const email = body.email as string;

  if (!token || !userId || !email) {
    return c.json({ error: "Faltan token, userId o email" }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc("api_aceptar_invitacion_familiar", {
    p_token: token,
    p_user_id: userId,
    p_email: email,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ grupoId: data });
});

app.post("/make-server-9380b593/familia/cambiar-rol", async (c) => {
  const body = await c.req.json();
  const ownerId = body.ownerId as string;
  const emailMiembro = body.emailMiembro as string;
  const nuevoRol = body.nuevoRol as string;
  const contrasenaFamiliar = body.contrasenaFamiliar as string;

  if (!ownerId || !emailMiembro || !nuevoRol || !contrasenaFamiliar) {
    return c.json({ error: "Faltan ownerId, emailMiembro, nuevoRol o contrasenaFamiliar" }, 400);
  }

  const { error } = await supabaseAdmin.rpc("api_cambiar_rol_miembro_familiar", {
    p_owner_id: ownerId,
    p_email_miembro: emailMiembro,
    p_nuevo_rol: nuevoRol,
    p_contrasena_familiar: contrasenaFamiliar,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ ok: true });
});

app.post("/make-server-9380b593/familia/expulsar", async (c) => {
  const body = await c.req.json();
  const ownerId = body.ownerId as string;
  const emailMiembro = body.emailMiembro as string;
  const contrasenaFamiliar = body.contrasenaFamiliar as string;

  if (!ownerId || !emailMiembro || !contrasenaFamiliar) {
    return c.json({ error: "Faltan ownerId, emailMiembro o contrasenaFamiliar" }, 400);
  }

  const { error } = await supabaseAdmin.rpc("api_expulsar_miembro_familiar", {
    p_owner_id: ownerId,
    p_email_miembro: emailMiembro,
    p_contrasena_familiar: contrasenaFamiliar,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ ok: true });
});

Deno.serve(app.fetch);