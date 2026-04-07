import { Navigate, Outlet } from "react-router";
import { useAuthSession } from "../context/AuthSessionContext";

function FullscreenLoader({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-lg font-semibold text-gray-700">{message}</p>
    </div>
  );
}

export function RequireAuth() {
  const { isLoading, user } = useAuthSession();

  if (isLoading) {
    return <FullscreenLoader message="Cargando sesion..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function GuestOnly() {
  const { isLoading, user } = useAuthSession();

  if (isLoading) {
    return <FullscreenLoader message="Cargando sesion..." />;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}