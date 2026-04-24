import { useMemo } from "react";

import { useAcademic } from "../context/AcademicContext";
import { sortTasksByDate } from "../lib/tasks";
import type { Task } from "../types";
import { TaskCard } from "./TaskCard";

interface TaskListProps {
  onEdit: (task: Task) => void;
}

export const TaskList = ({ onEdit }: TaskListProps) => {
  const { tasks, subjects, selectedSubjectId } = useAcademic();

  const visibleTasks = useMemo(() => {
    const filtered = selectedSubjectId ? tasks.filter((task) => task.subjectId === selectedSubjectId) : tasks;
    return sortTasksByDate(filtered);
  }, [selectedSubjectId, tasks]);

  const pendingTasks = useMemo(() => visibleTasks.filter((task) => !task.completed), [visibleTasks]);
  const completedTasks = useMemo(() => visibleTasks.filter((task) => task.completed), [visibleTasks]);

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-[0_24px_80px_rgba(120,53,15,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Tareas y evaluaciones</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            {selectedSubjectId ? "Vista filtrada por asignatura" : "Vista general"}
          </h2>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600">
          {visibleTasks.length} elemento(s)
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        {pendingTasks.length > 0 ? (
          pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              subject={subjectById.get(task.subjectId)}
              onEdit={onEdit}
            />
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center text-stone-500">
            No hay tareas pendientes para el filtro actual.
          </div>
        )}
      </div>

      {selectedSubjectId === null && (
        <div className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Completadas</p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900">Historial global</h3>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              {completedTasks.length} cerrada(s)
            </span>
          </div>

          <div className="mt-4 grid gap-4">
            {completedTasks.length > 0 ? (
              completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subject={subjectById.get(task.subjectId)}
                  onEdit={onEdit}
                />
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center text-emerald-700">
                Aun no hay tareas completadas.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
