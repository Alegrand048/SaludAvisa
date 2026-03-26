import { Pill, Plus, Clock, ArrowLeft } from "lucide-react";
import { Card } from "../components/ui/card";
import { BottomNav } from "../components/BottomNav";
import { useNavigate } from "react-router";
import { useMedicationsController } from "../controllers/useMedicationsController";

function formatTimeTo12h(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export default function Medications() {
  const navigate = useNavigate();
  const { medications, count, markAsTaken } = useMedicationsController();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
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
              <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Pill className="size-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Mi Medicación</h1>
                <p className="text-lg text-gray-600">{count} medicamentos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {medications.map((med) => (
          <Card
            key={med.id}
            className={`p-6 bg-gradient-to-br ${med.color} border-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{med.emoji}</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{med.name}</h3>
                    <p className="text-xl text-gray-700">{med.dosage}</p>
                  </div>
                </div>

                <div className="space-y-2 pl-14">
                  <div className="flex items-center gap-2 text-lg text-gray-700">
                    <Clock className="size-5" />
                    <span className="font-semibold">{med.times.map(formatTimeTo12h).join(" y ")}</span>
                  </div>
                  <p className="text-lg text-gray-600">{med.frequencyLabel}</p>
                </div>
              </div>

              <button
                className="size-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md"
                onClick={() => markAsTaken(med.id)}
              >
                <span className="text-xl">✓</span>
              </button>
            </div>
          </Card>
        ))}

        {medications.length === 0 ? (
          <Card className="p-6 text-center text-lg text-gray-600">No hay medicacion activa.</Card>
        ) : null}
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-24 right-6 size-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center z-20"
        onClick={() => window.alert("Formulario de alta de medicacion: proximo paso de implementacion")}
      >
        <Plus className="size-9" strokeWidth={3} />
      </button>

      <BottomNav />
    </div>
  );
}
