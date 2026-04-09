import { useState } from "react";
import { authService } from "../services/authService";
import type { UserRole } from "../context/AuthSessionContext";

export function useControladorAutenticacion() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const limpiarMensajes = () => {
    setError(null);
    setMessage(null);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      limpiarMensajes();
      await authService.signIn(email, password);
      setMessage("Inicio de sesion correcto.");
      return true;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo iniciar sesion.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string, role: UserRole, avatarUrl?: string) => {
    try {
      setIsLoading(true);
      limpiarMensajes();
      await authService.signUp(name, email, password, role, avatarUrl);
      setMessage("Cuenta creada. Ya puedes usar la app.");
      return true;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo crear la cuenta.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      limpiarMensajes();
      await authService.resetPassword(email);
      setMessage("Te hemos enviado un correo para restablecer la contrasena.");
      return true;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo enviar el correo.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPassword = async (password: string): Promise<{ ok: boolean; errorMessage?: string }> => {
    try {
      setIsLoading(true);
      limpiarMensajes();
      await authService.verifyPassword(password);
      return { ok: true };
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : "Contrasena inválida.";
      setError(errorMessage);
      return { ok: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const updateDisplayName = async (password: string, name: string): Promise<{ ok: boolean; errorMessage?: string }> => {
    try {
      setIsLoading(true);
      limpiarMensajes();
      await authService.updateDisplayNameSecure(password, name);
      setMessage("Nombre actualizado correctamente.");
      return { ok: true };
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : "No se pudo actualizar el nombre.";
      setError(errorMessage);
      return { ok: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (password: string): Promise<{ ok: boolean; errorMessage?: string }> => {
    try {
      setIsLoading(true);
      limpiarMensajes();
      await authService.deleteAccount(password);
      setMessage("Cuenta eliminada correctamente.");
      return { ok: true };
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : "No se pudo eliminar la cuenta.";
      setError(errorMessage);
      return { ok: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    message,
    clearFeedback: limpiarMensajes,
    signIn,
    signUp,
    resetPassword,
    verifyPassword,
    updateDisplayName,
    deleteAccount,
  };
}

export const useAuthController = useControladorAutenticacion;
