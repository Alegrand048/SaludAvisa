import { Home, Pill, Calendar, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/home", icon: Home, label: "Inicio" },
    { path: "/medications", icon: Pill, label: "Medicación" },
    { path: "/appointments", icon: Calendar, label: "Citas" },
    { path: "/profile", icon: User, label: "Perfil" },
  ];

  return (
    <nav className="app-bottom-nav">
      <div>
        <div className="flex items-center justify-around gap-1 px-2 py-2.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-pill flex min-w-0 flex-col items-center gap-1 ${
                isActive ? "nav-pill--active" : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              }`}
            >
              <Icon className="size-6" strokeWidth={2.35} />
              <span className="text-[0.7rem] font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
