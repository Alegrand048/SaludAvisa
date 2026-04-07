import { Heart, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-emerald-50 px-4 py-6">
      <div className="absolute -top-24 left-[-4rem] size-64 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="absolute bottom-0 right-[-5rem] size-72 rounded-full bg-emerald-200/35 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <div className="app-page-card p-6 text-center sm:p-8">
          <div className="flex justify-center">
            <div className="size-24 rounded-[1.8rem] border border-primary/10 bg-primary/8 shadow-sm flex items-center justify-center">
              <Heart className="size-12 text-primary" fill="currentColor" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <span className="eyebrow-chip">SaludAvisa</span>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Cuida mejor, sin ruido visual</h1>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Un espacio claro para medicación, citas y seguimiento familiar desde el móvil.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            <Button
              onClick={() => navigate("/login")}
              size="lg"
              className="w-full h-14 rounded-[1.35rem] bg-primary text-base font-semibold shadow-sm hover:bg-primary/90"
            >
              Iniciar sesión
              <ArrowRight className="ml-2 size-5" />
            </Button>

            <Button
              onClick={() => navigate("/register")}
              size="lg"
              variant="outline"
              className="w-full h-14 rounded-[1.35rem] border-border/70 bg-card/85 text-base font-semibold shadow-sm hover:bg-secondary/70"
            >
              Registrarse
            </Button>
          </div>

          <div className="mt-7 space-y-3 text-left">
            <div className="flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-background/70 p-4">
              <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl">💊</span>
              </div>
              <p className="text-sm font-medium text-foreground sm:text-base">Medicación con una vista simple y directa</p>
            </div>

            <div className="flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-background/70 p-4">
              <div className="size-11 rounded-2xl bg-secondary/80 flex items-center justify-center shrink-0">
                <span className="text-xl">📅</span>
              </div>
              <p className="text-sm font-medium text-foreground sm:text-base">Citas y recordatorios con más claridad</p>
            </div>

            <div className="flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-background/70 p-4">
              <div className="size-11 rounded-2xl bg-accent/80 flex items-center justify-center shrink-0">
                <span className="text-xl">👨‍👩‍👧</span>
              </div>
              <p className="text-sm font-medium text-foreground sm:text-base">Seguimiento compartido sin saturar la pantalla</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
