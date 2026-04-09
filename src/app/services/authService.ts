import { supabase } from "./supabaseClient";
import type { UserRole } from "../context/AuthSessionContext";
import { projectId } from "../../../utils/supabase/info";

function normalizeSupabaseErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("load failed")) {
    return "No se pudo conectar con Supabase. Verifica Internet, project URL/KEY y que el proyecto este activo.";
  }
  return message;
}

export const servicioAutenticacion = {
  async iniciarSesion(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(normalizeSupabaseErrorMessage(error.message));
    }
  },

  async registrarUsuario(name: string, email: string, password: string, role: UserRole, avatarUrl?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          avatar_url: avatarUrl ?? null,
        },
      },
    });
    if (error) {
      throw new Error(normalizeSupabaseErrorMessage(error.message));
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error(
          normalizeSupabaseErrorMessage(
            "No se pudo iniciar sesion automaticamente tras el registro. Revisa la configuracion de verificacion por correo en Supabase.",
          ),
        );
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const payloadConAvatar = {
        usuario_id: user.id,
        nombre_completo: name.trim(),
        email: email.trim().toLowerCase(),
        avatar_url: avatarUrl ?? null,
      };

      const { error: profileError } = await supabase.from("perfiles").upsert(payloadConAvatar, { onConflict: "usuario_id" });
      if (profileError && (profileError.message.toLowerCase().includes("avatar_url") || profileError.message.toLowerCase().includes("column"))) {
        const { error: legacyProfileError } = await supabase
          .from("perfiles")
          .upsert(
            {
              usuario_id: user.id,
              nombre_completo: name.trim(),
              email: email.trim().toLowerCase(),
              avatar_emoji: avatarUrl ?? "",
            },
            { onConflict: "usuario_id" },
          );
        if (legacyProfileError) {
          throw new Error(normalizeSupabaseErrorMessage(legacyProfileError.message));
        }
      } else if (profileError) {
        throw new Error(normalizeSupabaseErrorMessage(profileError.message));
      }
    }
  },

  async restablecerContrasena(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      throw new Error(normalizeSupabaseErrorMessage(error.message));
    }
  },

  async validarContrasena(password: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      throw new Error("No hay una sesion activa.");
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (reauthError) {
      throw new Error("Contrasena incorrecta.");
    }
  },

  async actualizarNombreSeguro(password: string, name: string) {
    await this.validarContrasena(password);
    const cleanedName = name.trim();
    if (!cleanedName) {
      throw new Error("El nombre no puede estar vacío.");
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        name: cleanedName,
      },
    });

    if (error) {
      throw new Error(normalizeSupabaseErrorMessage(error.message));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const { error: profileError } = await supabase
        .from("perfiles")
        .upsert(
          {
            usuario_id: user.id,
            nombre_completo: cleanedName,
            email: user.email?.toLowerCase() ?? null,
          },
          { onConflict: "usuario_id" },
        );
      if (profileError) {
        throw new Error(normalizeSupabaseErrorMessage(profileError.message));
      }
    }
  },

  async eliminarCuentaActual(password: string) {
    await this.validarContrasena(password);

    const { error: deleteError } = await supabase.rpc("eliminar_mi_cuenta");
    if (!deleteError) {
      await supabase.auth.signOut();
      return;
    }

    const message = deleteError.message.toLowerCase();
    if (message.includes("schema cache") || message.includes("could not find the function")) {
      throw new Error(
        `Supabase no encuentra la funcion eliminar_mi_cuenta en cache para el proyecto ${projectId}. Ejecuta el script SQL en ese mismo proyecto (no en otro) y vuelve a intentarlo.`,
      );
    }

    if (deleteError.code === "42883" || message.includes("does not exist")) {
      throw new Error(
        "La funcion SQL eliminar_mi_cuenta no existe todavia. Ejecuta 00_minimo_indispensable_es.sql y fix_eliminar_cuenta_es.sql en Supabase SQL Editor.",
      );
    }

    if (deleteError.code === "42501" || message.includes("permission denied")) {
      throw new Error(
        "Tu usuario no tiene permiso para ejecutar eliminar_mi_cuenta. Ejecuta 00_minimo_indispensable_es.sql y fix_eliminar_cuenta_es.sql para aplicar grants y politicas.",
      );
    }

    throw new Error(`No se pudo borrar la cuenta: ${deleteError.message}`);
  },
};

export const authService = {
  signIn: servicioAutenticacion.iniciarSesion,
  signUp: servicioAutenticacion.registrarUsuario,
  resetPassword: servicioAutenticacion.restablecerContrasena,
  verifyPassword: servicioAutenticacion.validarContrasena,
  updateDisplayNameSecure: servicioAutenticacion.actualizarNombreSeguro,
  deleteAccount: servicioAutenticacion.eliminarCuentaActual,
};
