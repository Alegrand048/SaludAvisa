import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Medicine } from "./MedicineList";
import { Pill, Package, Clock, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface MedicineDetailDialogProps {
  medicine: Medicine | null;
  open: boolean;
  onClose: () => void;
  onUpdateStock: (id: string, newStock: number) => void;
  onDelete: (id: string) => void;
}

export function MedicineDetailDialog({
  medicine,
  open,
  onClose,
  onUpdateStock,
  onDelete,
}: MedicineDetailDialogProps) {
  const [stockInput, setStockInput] = useState("");

  if (!medicine) return null;

  const handleAddStock = () => {
    const amount = parseInt(stockInput);
    if (!isNaN(amount) && amount > 0) {
      onUpdateStock(medicine.id, medicine.stock + amount);
      setStockInput("");
    }
  };

  const handleRemoveOne = () => {
    if (medicine.stock > 0) {
      onUpdateStock(medicine.id, medicine.stock - 1);
    }
  };

  const handleDelete = () => {
    if (confirm(`¿Estás seguro de eliminar ${medicine.name}?`)) {
      onDelete(medicine.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="size-12 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: medicine.color + "20" }}
            >
              <Pill className="size-6" style={{ color: medicine.color }} />
            </div>
            <div className="flex-1">
              <DialogTitle>{medicine.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{medicine.dosage}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Package className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Stock actual</p>
              <p className="text-2xl font-bold">{medicine.stock}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Frecuencia</p>
              <p className="font-medium">{medicine.frequency}</p>
            </div>
          </div>

          {medicine.nextDose && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Clock className="size-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Próxima toma</p>
                <p className="font-medium text-blue-600">
                  {medicine.nextDose.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Gestionar stock</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRemoveOne}
                disabled={medicine.stock === 0}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                placeholder="Cantidad a agregar"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                min="0"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddStock}
                disabled={!stockInput || parseInt(stockInput) <= 0}
              >
                <Plus className="size-4 mr-1" />
                Agregar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            className="gap-2"
          >
            <Trash2 className="size-4" />
            Eliminar
          </Button>
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
