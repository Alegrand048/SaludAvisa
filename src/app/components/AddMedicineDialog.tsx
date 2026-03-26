import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Medicine } from "./MedicineList";

interface AddMedicineDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (medicine: Omit<Medicine, "id">) => void;
}

const COLORS = [
  { name: "Azul", value: "#3b82f6" },
  { name: "Verde", value: "#10b981" },
  { name: "Morado", value: "#8b5cf6" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Naranja", value: "#f97316" },
  { name: "Rojo", value: "#ef4444" },
];

const FREQUENCIES = [
  "Cada 4 horas",
  "Cada 6 horas",
  "Cada 8 horas",
  "Cada 12 horas",
  "Una vez al día",
  "Dos veces al día",
  "Tres veces al día",
];

export function AddMedicineDialog({ open, onClose, onAdd }: AddMedicineDialogProps) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [stock, setStock] = useState("");
  const [frequency, setFrequency] = useState("");
  const [color, setColor] = useState(COLORS[0].value);
  const [nextDoseTime, setNextDoseTime] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !dosage || !stock || !frequency) {
      return;
    }

    const nextDose = nextDoseTime ? new Date() : undefined;
    if (nextDose && nextDoseTime) {
      const [hours, minutes] = nextDoseTime.split(":");
      nextDose.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    onAdd({
      name,
      dosage,
      stock: parseInt(stock),
      frequency,
      color,
      nextDose,
    });

    // Reset form
    setName("");
    setDosage("");
    setStock("");
    setFrequency("");
    setColor(COLORS[0].value);
    setNextDoseTime("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agregar Medicamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del medicamento</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Ibuprofeno"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dosage">Dosis</Label>
            <Input
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="ej. 400mg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock">Cantidad en stock</Label>
            <Input
              id="stock"
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="ej. 20"
              min="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frecuencia</Label>
            <Select value={frequency} onValueChange={setFrequency} required>
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Seleccionar frecuencia" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {freq}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextDose">Próxima toma (opcional)</Label>
            <Input
              id="nextDose"
              type="time"
              value={nextDoseTime}
              onChange={(e) => setNextDoseTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`size-10 rounded-full transition-transform ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
