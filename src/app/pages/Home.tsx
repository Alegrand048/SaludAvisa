import { Heart, Pill, Calendar, Plus, Bell } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useDashboardController } from "../controllers/useDashboardController";
import { useProfileController } from "../controllers/useProfileController";
import { useMedicationsController } from "../controllers/useMedicationsController";

function formatAppointmentDate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatAppointmentTime(dateTime: string): string {
  return new Date(dateTime).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Home() {
  const navigate = useNavigate();
  const { nextMedication, nextAppointment, refresh } = useDashboardController();
  const { profile } = useProfileController();
  const { markAsTaken } = useMedicationsController();

  const handleMarkAsTaken = () => {
    if (!nextMedication) {
      return;
    }
    markAsTaken(nextMedication.medication.id);
    refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-14 bg-green-100 rounded-full flex items-center justify-center">
                <Heart className="size-8 text-green-600" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Hola, {profile.name}</h1>
                <p className="text-lg text-gray-600">¿Cómo te encuentras hoy?</p>
              </div>
            </div>
            <button
              className="size-12 bg-blue-100 rounded-full flex items-center justify-center"
              onClick={() => navigate("/profile")}
            >
              <Bell className="size-6 text-blue-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Próxima medicación */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Pill className="size-7 text-blue-600" />
            Próxima medicación
          </h2>
          <Card className="p-6 bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-300 shadow-lg">
            {nextMedication ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-bold text-gray-800">{nextMedication.medication.name}</h3>
                    <p className="text-2xl text-gray-700">{nextMedication.medication.dosage}</p>
                    <p className="text-xl font-semibold text-blue-700 mt-3">
                      🕐 En {nextMedication.minutesUntil} minutos - {nextMedication.timeLabel}
                    </p>
                  </div>
                  <div className="size-20 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Pill className="size-10 text-blue-600" />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-xl font-bold mt-4 bg-blue-600 hover:bg-blue-700"
                  onClick={handleMarkAsTaken}
                >
                  ✓ Marcar como tomado
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xl font-semibold text-gray-700">No hay medicacion programada</p>
              </div>
            )}
          </Card>
        </div>

        {/* Próxima cita */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="size-7 text-green-600" />
            Próxima cita médica
          </h2>
          <Card className="p-6 bg-gradient-to-br from-green-100 to-green-50 border-2 border-green-300 shadow-lg">
            {nextAppointment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-bold text-gray-800">{nextAppointment.specialty}</h3>
                  <div className="size-16 bg-white rounded-full flex items-center justify-center shadow-md">
                    <span className="text-3xl">{nextAppointment.emoji}</span>
                  </div>
                </div>
                <div className="space-y-2 text-xl text-gray-700">
                  <p className="font-semibold">📅 {formatAppointmentDate(nextAppointment.dateTime)}</p>
                  <p className="font-semibold">🕐 {formatAppointmentTime(nextAppointment.dateTime)}</p>
                  <p>📍 {nextAppointment.location}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xl font-semibold text-gray-700">No hay citas pendientes</p>
              </div>
            )}
          </Card>
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <Button
            onClick={() => navigate("/medications")}
            size="lg"
            variant="outline"
            className="h-24 flex-col gap-2 text-lg font-bold border-2 hover:bg-blue-50"
          >
            <Plus className="size-8" />
            Añadir medicación
          </Button>

          <Button
            onClick={() => navigate("/appointments")}
            size="lg"
            variant="outline"
            className="h-24 flex-col gap-2 text-lg font-bold border-2 hover:bg-green-50"
          >
            <Plus className="size-8" />
            Añadir cita
          </Button>
        </div>

        {/* Recordatorio amigable */}
        <Card className="p-6 bg-gradient-to-br from-purple-100 to-pink-50 border-2 border-purple-200">
          <div className="flex items-center gap-4">
            <span className="text-4xl">💡</span>
            <div>
              <p className="text-xl font-semibold text-gray-800">Consejo del día</p>
              <p className="text-lg text-gray-700 mt-1">
                Recuerda tomar tus medicinas con un vaso de agua lleno
              </p>
            </div>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
