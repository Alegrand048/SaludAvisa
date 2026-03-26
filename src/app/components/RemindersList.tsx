import { Clock, Check, AlertCircle } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export interface Reminder {
  id: string;
  medicineName: string;
  dosage: string;
  time: Date;
  taken: boolean;
  color: string;
}

interface RemindersListProps {
  reminders: Reminder[];
  onMarkTaken: (id: string) => void;
}

export function RemindersList({ reminders, onMarkTaken }: RemindersListProps) {
  const now = new Date();
  const upcomingReminders = reminders.filter(r => !r.taken && r.time > now);
  const pendingReminders = reminders.filter(r => !r.taken && r.time <= now);
  const takenReminders = reminders.filter(r => r.taken);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Recordatorios de Hoy</h2>

      {pendingReminders.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" />
            <span>Pendientes</span>
          </div>
          {pendingReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onMarkTaken={onMarkTaken}
              isPending
            />
          ))}
        </div>
      )}

      {upcomingReminders.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <Clock className="size-4" />
            <span>Próximos</span>
          </div>
          {upcomingReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onMarkTaken={onMarkTaken}
            />
          ))}
        </div>
      )}

      {takenReminders.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <Check className="size-4" />
            <span>Completados</span>
          </div>
          {takenReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onMarkTaken={onMarkTaken}
              isTaken
            />
          ))}
        </div>
      )}

      {reminders.length === 0 && (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Clock className="size-12 opacity-50" />
            <p>No hay recordatorios para hoy</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function ReminderCard({
  reminder,
  onMarkTaken,
  isPending = false,
  isTaken = false,
}: {
  reminder: Reminder;
  onMarkTaken: (id: string) => void;
  isPending?: boolean;
  isTaken?: boolean;
}) {
  return (
    <Card
      className={`p-4 ${
        isPending ? 'border-red-200 bg-red-50/50' : 
        isTaken ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: reminder.color + "20" }}
        >
          <Clock className="size-5" style={{ color: reminder.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{reminder.medicineName}</h3>
          <p className="text-sm text-muted-foreground">{reminder.dosage}</p>
          <p className="text-sm font-medium mt-1">
            {reminder.time.toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {!isTaken ? (
          <Button
            onClick={() => onMarkTaken(reminder.id)}
            size="sm"
            variant={isPending ? "default" : "outline"}
            className="gap-2"
          >
            <Check className="size-4" />
            Marcar
          </Button>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Check className="size-3" />
            Tomado
          </Badge>
        )}
      </div>
    </Card>
  );
}
