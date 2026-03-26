import { Pill, Plus, AlertCircle } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  stock: number;
  frequency: string;
  nextDose?: Date;
  color: string;
}

interface MedicineListProps {
  medicines: Medicine[];
  onAddMedicine: () => void;
  onMedicineClick: (medicine: Medicine) => void;
}

export function MedicineList({ medicines, onAddMedicine, onMedicineClick }: MedicineListProps) {
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Sin stock", variant: "destructive" as const };
    if (stock <= 5) return { label: "Stock bajo", variant: "default" as const };
    return { label: "Stock OK", variant: "secondary" as const };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mis Medicamentos</h2>
        <Button onClick={onAddMedicine} size="sm" className="gap-2">
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      {medicines.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Pill className="size-12 opacity-50" />
            <p>No hay medicamentos registrados</p>
            <Button onClick={onAddMedicine} variant="outline" className="gap-2 mt-2">
              <Plus className="size-4" />
              Agregar primer medicamento
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {medicines.map((medicine) => {
            const stockStatus = getStockStatus(medicine.stock);
            return (
              <Card
                key={medicine.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onMedicineClick(medicine)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="size-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: medicine.color + "20" }}
                  >
                    <Pill className="size-6" style={{ color: medicine.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{medicine.name}</h3>
                        <p className="text-sm text-muted-foreground">{medicine.dosage}</p>
                      </div>
                      <Badge variant={stockStatus.variant} className="shrink-0">
                        {stockStatus.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-muted-foreground">
                        Stock: <span className="font-medium text-foreground">{medicine.stock}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {medicine.frequency}
                      </span>
                    </div>
                    {medicine.nextDose && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-blue-600">
                        <AlertCircle className="size-3" />
                        <span>
                          Próxima: {medicine.nextDose.toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
