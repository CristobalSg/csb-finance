import { formatDate, getDaysUntil, getUrgencyTone } from "../lib/date";
import type { Subject, Task } from "../types";

interface TaskCardProps {
  task: Task;
  subject?: Subject;
  onEdit: (task: Task) => void;
}

const toneStyles = {
  danger: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  safe: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export const TaskCard = ({ task, subject, onEdit }: TaskCardProps) => {
  const daysUntil = getDaysUntil(task.dueDate);
  const tone = getUrgencyTone(daysUntil);
  const daysLabel =
    daysUntil < 0 ? `Atrasada ${Math.abs(daysUntil)} dia(s)` : daysUntil === 0 ? "Hoy" : `En ${daysUntil} dia(s)`;
  const subjectColor = subject?.color ?? "#78716c";
  const previewLine = task.description?.split("\n").find((line) => line.trim())?.trim() ?? "";

  return (
    <button
      type="button"
      onClick={() => onEdit(task)}
      className={`w-full rounded-[1.75rem] border p-5 text-left shadow-[0_18px_50px_rgba(120,53,15,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(120,53,15,0.14)] ${
        task.completed
          ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
          : "border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">
              {task.type === "exam" ? "Prueba" : "Tarea"}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneStyles[tone]}`}>
              {daysLabel}
            </span>
            {task.completed && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Completada
              </span>
            )}
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: `${subjectColor}18`,
                color: subjectColor,
              }}
            >
              {subject?.name ?? "Sin asignatura"}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
              {formatDate(task.dueDate)}
            </span>
          </div>

          <h3 className={`mt-4 text-lg font-semibold ${task.completed ? "text-stone-700" : "text-stone-900"}`}>
            {task.title}
          </h3>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
          Presiona para editar
        </span>
      </div>

      {previewLine && <p className="mt-4 line-clamp-1 text-sm leading-6 text-stone-600">{previewLine}</p>}
    </button>
  );
};
