import { useState } from "react";
import { Heart, Mail, Lock, Eye, EyeOff, ArrowLeft, User, Shield, Check, Camera } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useNavigate } from "react-router";
import { useAuthController } from "../controllers/useAuthController";
import type { UserRole } from "../context/AuthSessionContext";

export default function Register() {
  const navigate = useNavigate();
  const { signUp, isLoading, error, message, clearFeedback } = useAuthController();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("usuario");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAvatarPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await signUp(name, email, password, role, avatarPreview ?? undefined);
    if (success) {
      navigate("/home");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-sky-50">
      <div className="absolute -top-28 right-[-4rem] size-72 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="absolute bottom-0 left-[-5rem] size-72 rounded-full bg-sky-200/35 blur-3xl" />

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

            <div className="space-y-2 text-center mb-5">
              <span className="eyebrow-chip">Crea tu cuenta</span>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Empieza con SaludAvisa</h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Elige cómo vas a usar la app. Puedes cambiarlo después si lo necesitas.
              </p>
            </div>

            <div className="w-full space-y-3 mb-5">
              <Label className="text-sm font-semibold text-foreground">Tipo de usuario</Label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("usuario")}
                  className={`rounded-[1.35rem] border-2 p-4 text-left transition-all ${
                    role === "usuario"
                      ? "border-primary bg-primary/8 shadow-sm ring-2 ring-primary/15"
                      : "border-border/70 bg-card hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-11 rounded-2xl flex items-center justify-center ${
                        role === "usuario" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <User className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-foreground">Cliente</p>
                        {role === "usuario" ? <Check className="size-4 text-primary" /> : null}
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">Consulta medicación y confirma tomas.</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("familiar_cuidador")}
                  className={`sm:col-span-2 rounded-[1.35rem] border-2 p-4 text-left transition-all ${
                    role === "familiar_cuidador"
                      ? "border-primary bg-primary/8 shadow-sm ring-2 ring-primary/15"
                      : "border-border/70 bg-card hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-11 rounded-2xl flex items-center justify-center ${
                        role === "familiar_cuidador" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Shield className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-foreground">Familiar/Cuidador</p>
                        {role === "familiar_cuidador" ? <Check className="size-4 text-primary" /> : null}
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">
                        Apoya al cliente y comparte la gestión del cuidado.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2 text-center mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Crear cuenta</h2>
              <p className="text-sm text-muted-foreground sm:text-base">Comienza a usar SaludAvisa</p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                  Nombre completo
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={clearFeedback}
                    placeholder="Tu nombre"
                    className="h-14 rounded-[1.25rem] border-border/70 bg-background pl-12 pr-4 text-base"
                    required
                  />
                </div>
              </div>

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
                    placeholder="Mínimo 6 caracteres"
                    className="h-14 rounded-[1.25rem] border-border/70 bg-background pl-12 pr-12 text-base"
                    minLength={6}
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

              <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-card/70 p-3 sm:p-4">
                <Label htmlFor="avatar" className="text-sm font-semibold text-foreground">
                  Foto de perfil (opcional)
                </Label>
                <div className="flex items-center gap-3">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Vista previa" className="size-14 rounded-xl object-cover border border-border/70" />
                  ) : (
                    <div className="size-14 rounded-xl bg-secondary/80 border border-border/70 flex items-center justify-center">
                      <Camera className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="h-11 rounded-xl border-border/70 bg-background/90 text-sm"
                  />
                </div>
              </div>

              {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
              {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full h-14 rounded-[1.35rem] bg-primary text-base font-semibold shadow-sm hover:bg-primary/90"
              >
                {isLoading ? "Creando cuenta..." : "Registrarme"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <button className="font-semibold text-primary underline decoration-primary/30 underline-offset-4" onClick={() => navigate("/login")}>
                Inicia sesión
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
