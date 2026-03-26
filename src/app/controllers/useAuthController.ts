import { useState } from "react";
import { authService } from "../services/authService";

export function useAuthController() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      clearFeedback();
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

  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      clearFeedback();
      await authService.signUp(email, password);
      setMessage("Cuenta creada. Revisa tu correo para confirmar el registro.");
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
      clearFeedback();
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

  return {
    isLoading,
    error,
    message,
    clearFeedback,
    signIn,
    signUp,
    resetPassword,
  };
}
