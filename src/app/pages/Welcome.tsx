import { Heart, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-green-50 to-blue-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="size-32 bg-white rounded-full shadow-xl flex items-center justify-center">
            <Heart className="size-16 text-green-500" fill="currentColor" />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-gray-800">SaludAvisa</h1>
          <p className="text-2xl text-gray-600 leading-relaxed px-4">
            Tu compañero para recordar medicación y citas médicas
          </p>
        </div>

        {/* Botones */}
        <div className="space-y-4 pt-8">
          <Button
            onClick={() => navigate("/login")}
            size="lg"
            className="w-full h-16 text-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
          >
            Iniciar sesión
            <ArrowRight className="ml-2 size-6" />
          </Button>

          <Button
            onClick={() => navigate("/register")}
            size="lg"
            variant="outline"
            className="w-full h-16 text-2xl font-bold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 shadow-md"
          >
            Registrarse
          </Button>
        </div>

        {/* Beneficios */}
        <div className="pt-8 space-y-3">
          <div className="flex items-center gap-3 text-left bg-white/60 p-4 rounded-2xl">
            <div className="size-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-2xl">💊</span>
            </div>
            <p className="text-lg text-gray-700">Nunca olvides tu medicación</p>
          </div>

          <div className="flex items-center gap-3 text-left bg-white/60 p-4 rounded-2xl">
            <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-lg text-gray-700">Recordatorios de tus citas</p>
          </div>

          <div className="flex items-center gap-3 text-left bg-white/60 p-4 rounded-2xl">
            <div className="size-12 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-2xl">👨‍👩‍👧</span>
            </div>
            <p className="text-lg text-gray-700">Comparte con tu familia</p>
          </div>
        </div>
      </div>
    </div>
  );
}
