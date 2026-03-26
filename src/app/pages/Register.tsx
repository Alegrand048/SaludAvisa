import { useState } from "react";
import { Heart, Mail, Lock, Eye, EyeOff, ArrowLeft, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useNavigate } from "react-router";
import { useAuthController } from "../controllers/useAuthController";

export default function Register() {
  const navigate = useNavigate();
  const { signUp, isLoading, error, message, clearFeedback } = useAuthController();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await signUp(email, password);
    if (success) {
      setTimeout(() => navigate("/login"), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 flex flex-col p-6">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-gray-600 mb-6 text-xl"
      >
        <ArrowLeft className="size-6" />
        Volver
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto">
        <div className="flex justify-center mb-6">
          <div className="size-24 bg-white rounded-full shadow-lg flex items-center justify-center">
            <Heart className="size-12 text-green-500" fill="currentColor" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-800 mb-2">Crear cuenta</h1>
        <p className="text-xl text-gray-600 mb-8">Comienza a usar SaludAvisa</p>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-xl font-semibold text-gray-700">
              Nombre completo
            </Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-gray-400" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={clearFeedback}
                placeholder="Tu nombre"
                className="h-16 pl-14 text-xl border-2"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="email" className="text-xl font-semibold text-gray-700">
              Correo electronico
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={clearFeedback}
                placeholder="ejemplo@correo.com"
                className="h-16 pl-14 text-xl border-2"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="password" className="text-xl font-semibold text-gray-700">
              Contrasena
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={clearFeedback}
                placeholder="Minimo 6 caracteres"
                className="h-16 pl-14 pr-14 text-xl border-2"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="size-6" /> : <Eye className="size-6" />}
              </button>
            </div>
          </div>

          {error ? <p className="text-base text-red-600 font-semibold">{error}</p> : null}
          {message ? <p className="text-base text-green-700 font-semibold">{message}</p> : null}

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className="w-full h-16 text-2xl font-bold bg-green-600 hover:bg-green-700 shadow-lg mt-8"
          >
            {isLoading ? "Creando cuenta..." : "Registrarme"}
          </Button>
        </form>

        <p className="text-lg text-gray-600 mt-6">
          ¿Ya tienes cuenta?{" "}
          <button
            className="text-blue-600 font-semibold underline"
            onClick={() => navigate("/login")}
          >
            Inicia sesion
          </button>
        </p>
      </div>
    </div>
  );
}
