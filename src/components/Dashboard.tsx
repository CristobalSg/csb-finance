import { useMemo } from "react";

import { useAcademic } from "../context/AcademicContext";
import { formatDate, getDaysUntil, getUrgencyTone } from "../lib/date";
import { getUpcomingExams, getUpcomingTasks } from "../lib/tasks";

const badgeTone = {
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  safe: "bg-emerald-100 text-emerald-700",
};

export const Dashboard = () => {
  const { tasks, subjects, selectedSubjectId } = useAcademic();

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );

  const filteredTasks = useMemo(() => {
    return selectedSubjectId ? tasks.filter((task) => task.subjectId === selectedSubjectId) : tasks;
  }, [selectedSubjectId, tasks]);

  const upcomingTasks = useMemo(() => getUpcomingTasks(filteredTasks, 7), [filteredTasks]);
  const upcomingExams = useMemo(() => getUpcomingExams(filteredTasks, 7), [filteredTasks]);
  const pendingCount = filteredTasks.filter((task) => !task.completed).length;
  const completedCount = filteredTasks.filter((task) => task.completed).length;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[2rem] border border-stone-200 bg-stone-900 p-6 text-white shadow-[0_24px_80px_rgba(28,25,23,0.22)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Gestion de tareas academicas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
          Revisa tus pendientes, proximas pruebas y archivos por asignatura en un solo lugar.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/8 p-4">
            <p className="text-sm text-stone-300">Pendientes</p>
            <p className="mt-2 text-3xl font-semibold">{pendingCount}</p>
          </div>
          <div className="rounded-2xl bg-white/8 p-4">
            <p className="text-sm text-stone-300">Completadas</p>
            <p className="mt-2 text-3xl font-semibold">{completedCount}</p>
          </div>
          <div className="rounded-2xl bg-white/8 p-4">
            <p className="text-sm text-stone-300">Proximas pruebas</p>
            <p className="mt-2 text-3xl font-semibold">{upcomingExams.length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(120,53,15,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Proximos 7 dias</p>
        <div className="mt-4 space-y-3">
          {upcomingTasks.length > 0 ? (
            upcomingTasks.slice(0, 5).map((task) => {
              const days = getDaysUntil(task.dueDate);
              const tone = getUrgencyTone(days);
              return (
                <article key={task.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-900">{task.title}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {subjectById.get(task.subjectId)?.name ?? "Sin asignatura"} • {formatDate(task.dueDate)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeTone[tone]}`}>
                      {task.type === "exam" ? "Prueba" : "Tarea"}
                    </span>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
              No hay pendientes proximos en los siguientes 7 dias.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
