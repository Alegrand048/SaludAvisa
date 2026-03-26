import { Calendar, Plus, MapPin, Clock, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useAppointmentsController } from "../controllers/useAppointmentsController";

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

export default function Appointments() {
  const navigate = useNavigate();
  const { appointments, count } = useAppointmentsController();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm p-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/home")}
              className="size-12 flex items-center justify-center"
            >
              <ArrowLeft className="size-7 text-gray-600" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="size-12 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="size-7 text-green-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Mis Citas</h1>
                <p className="text-lg text-gray-600">{count} citas programadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {appointments.map((apt) => (
          <Card
            key={apt.id}
            className={`p-6 bg-gradient-to-br ${apt.color} border-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}
          >
            <div className="flex items-start gap-4">
              <div className="size-16 bg-white rounded-full flex items-center justify-center shadow-md shrink-0">
                <span className="text-3xl">{apt.emoji}</span>
              </div>

              <div className="flex-1 space-y-3">
                <h3 className="text-2xl font-bold text-gray-800">{apt.specialty}</h3>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-lg text-gray-700">
                    <Calendar className="size-5" />
                    <span className="font-semibold">{formatAppointmentDate(apt.dateTime)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-lg text-gray-700">
                    <Clock className="size-5" />
                    <span className="font-semibold">{formatAppointmentTime(apt.dateTime)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-lg text-gray-700">
                    <MapPin className="size-5" />
                    <span>{apt.location}</span>
                  </div>

                  <div className="flex items-center gap-2 text-lg text-gray-700">
                    <span>👨‍⚕️</span>
                    <span>{apt.doctor}</span>
                  </div>
                </div>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 text-lg font-semibold border-2 mt-2"
                >
                  Ver detalles
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {appointments.length === 0 ? (
          <Card className="p-6 text-center text-lg text-gray-600">No hay citas registradas.</Card>
        ) : null}

        {/* Info adicional */}
        <Card className="p-6 bg-gradient-to-br from-yellow-100 to-yellow-50 border-2 border-yellow-300">
          <div className="flex items-center gap-4">
            <span className="text-3xl">💡</span>
            <div>
              <p className="text-lg font-semibold text-gray-800">Recuerda</p>
              <p className="text-base text-gray-700 mt-1">
                Lleva siempre tu DNI y tarjeta sanitaria a las citas
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-24 right-6 size-16 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-xl flex items-center justify-center z-20"
        onClick={() => window.alert("Formulario de nueva cita: proximo paso de implementacion")}
      >
        <Plus className="size-9" strokeWidth={3} />
      </button>

      <BottomNav />
    </div>
  );
}
