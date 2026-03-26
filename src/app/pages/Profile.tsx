import { User, Bell, Users, Phone, LogOut, ChevronRight, Heart } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useProfileController } from "../controllers/useProfileController";

export default function Profile() {
  const navigate = useNavigate();
  const {
    profile,
    toggleMedicationReminders,
    toggleAppointmentReminders,
    toggleSoundEnabled,
  } = useProfileController();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="size-12 bg-purple-100 rounded-full flex items-center justify-center">
              <User className="size-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Mi Perfil</h1>
              <p className="text-lg text-gray-600">Configuración y ajustes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Información del usuario */}
        <Card className="p-6 bg-gradient-to-br from-purple-100 to-purple-50 border-2">
          <div className="flex items-center gap-4">
            <div className="size-20 bg-white rounded-full flex items-center justify-center shadow-md">
              <span className="text-4xl">{profile.avatarEmoji}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800">{profile.name}</h2>
              <p className="text-lg text-gray-600">{profile.age} años</p>
              <p className="text-lg text-gray-600">{profile.email}</p>
            </div>
            <button className="size-12 bg-white rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xl">✏️</span>
            </button>
          </div>
        </Card>

        {/* Notificaciones */}
        <div className="space-y-3">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="size-7 text-blue-600" />
            Notificaciones
          </h3>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">💊</span>
                <div>
                  <p className="text-xl font-semibold text-gray-800">Recordatorios de medicación</p>
                  <p className="text-base text-gray-600">Avisos para tomar tu medicación</p>
                </div>
              </div>
              <Switch
                checked={profile.notifications.medicationReminders}
                onCheckedChange={toggleMedicationReminders}
                className="scale-125"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-xl font-semibold text-gray-800">Recordatorios de citas</p>
                    <p className="text-base text-gray-600">Avisos de citas médicas</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notifications.appointmentReminders}
                  onCheckedChange={toggleAppointmentReminders}
                  className="scale-125"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <p className="text-xl font-semibold text-gray-800">Sonido de alertas</p>
                    <p className="text-base text-gray-600">Activar sonido en recordatorios</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notifications.soundEnabled}
                  onCheckedChange={toggleSoundEnabled}
                  className="scale-125"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Familia y Cuidadores */}
        <div className="space-y-3">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="size-7 text-green-600" />
            Familia y cuidadores
          </h3>

          <Card className="p-6 space-y-4">
            {profile.caregivers.map((caregiver, index) => (
              <div
                key={caregiver.id}
                className={index === 0 ? "flex items-center justify-between" : "border-t pt-4 flex items-center justify-between"}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{caregiver.emoji}</span>
                  <div>
                    <p className="text-xl font-semibold text-gray-800">{caregiver.name}</p>
                    <p className="text-base text-gray-600">{caregiver.role}</p>
                  </div>
                </div>
                <button
                  className="size-10 bg-green-100 rounded-full flex items-center justify-center"
                  onClick={() => window.open(`tel:${caregiver.phone.replace(/\s+/g, "")}`, "_self")}
                >
                  <Phone className="size-5 text-green-600" />
                </button>
              </div>
            ))}

            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-lg font-semibold border-2 mt-2"
            >
              <Users className="size-5 mr-2" />
              Añadir familiar o cuidador
            </Button>
          </Card>
        </div>

        {/* Opciones adicionales */}
        <Card className="divide-y">
          <button
            className="flex items-center justify-between p-6 w-full hover:bg-gray-50 transition-colors"
            onClick={() => window.alert(`Contacto de emergencia: ${profile.emergencyPhone}`)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <span className="text-xl font-semibold text-gray-800">Contacto de emergencia</span>
            </div>
            <ChevronRight className="size-6 text-gray-400" />
          </button>

          <button
            className="flex items-center justify-between p-6 w-full hover:bg-gray-50 transition-colors"
            onClick={() => window.alert("Soporte: 900 123 456")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">❓</span>
              <span className="text-xl font-semibold text-gray-800">Ayuda y soporte</span>
            </div>
            <ChevronRight className="size-6 text-gray-400" />
          </button>

          <button
            className="flex items-center justify-between p-6 w-full hover:bg-gray-50 transition-colors"
            onClick={() => window.alert("SaludAvisa v1.0")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">ℹ️</span>
              <span className="text-xl font-semibold text-gray-800">Acerca de SaludAvisa</span>
            </div>
            <ChevronRight className="size-6 text-gray-400" />
          </button>
        </Card>

        {/* Botón de cerrar sesión */}
        <Button
          onClick={() => navigate("/")}
          size="lg"
          variant="outline"
          className="w-full h-16 text-xl font-semibold border-2 border-red-300 text-red-600 hover:bg-red-50"
        >
          <LogOut className="size-6 mr-2" />
          Cerrar sesión
        </Button>

        {/* Footer amigable */}
        <Card className="p-6 bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-200">
          <div className="flex flex-col items-center gap-3 text-center">
            <Heart className="size-8 text-blue-600" fill="currentColor" />
            <p className="text-lg text-gray-700">
              <strong>SaludAvisa</strong> está aquí para cuidarte
            </p>
            <p className="text-base text-gray-600">
              Si necesitas ayuda, llama al <strong>{profile.emergencyPhone}</strong>
            </p>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
