import { useState } from "react";
import { Heart, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useNavigate } from "react-router";
import { useAuthController } from "../controllers/useAuthController";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, resetPassword, isLoading, error, message, clearFeedback } = useAuthController();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await signIn(email, password);
    if (success) {
      navigate("/home");
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      return;
    }
    await resetPassword(email);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="absolute -top-24 left-[-4rem] size-64 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-0 right-[-5rem] size-72 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5 sm:px-6 sm:py-8">
        <button
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-card/80 px-3 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur"
        >
          <ArrowLeft className="size-5" />
          Volver
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <div className="app-page-card p-5 sm:p-7">
            <div className="flex justify-center mb-5">
              <div className="size-20 rounded-[1.7rem] border border-primary/10 bg-primary/8 shadow-sm flex items-center justify-center">
                <Heart className="size-10 text-primary" fill="currentColor" />
              </div>
            </div>

            <div className="space-y-2 text-center">
              <span className="eyebrow-chip">Acceso seguro</span>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Bienvenido de nuevo</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Inicia sesión para revisar recordatorios y cuidados.</p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-5 mt-7">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={clearFeedback}
                    placeholder="ejemplo@correo.com"
                    className="h-14 rounded-[1.25rem] border-border/70 bg-background pl-12 pr-4 text-base"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={clearFeedback}
                    placeholder="••••••••"
                    className="h-14 rounded-[1.25rem] border-border/70 bg-background pl-12 pr-12 text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-secondary/70 p-2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isLoading || !email}
                className="text-left text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 disabled:opacity-50"
              >
                ¿Olvidaste tu contraseña?
              </button>

              {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
              {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full h-14 rounded-[1.35rem] bg-primary text-base font-semibold shadow-sm hover:bg-primary/90"
              >
                {isLoading ? "Entrando..." : "Iniciar sesión"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <button className="font-semibold text-primary underline decoration-primary/30 underline-offset-4" onClick={() => navigate("/register")}>
                Regístrate aquí
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
