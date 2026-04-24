import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAcademic } from "../context/AcademicContext";
import { renderMarkdown } from "../lib/markdown";
import { useModalBehavior } from "../hooks/useModalBehavior";
import type { Task, TaskInput } from "../types";

interface CreateTaskModalProps {
  isOpen: boolean;
  taskToEdit: Task | null;
  onClose: () => void;
}

const emptyForm: TaskInput = {
  title: "",
  description: "",
  subjectId: "",
  dueDate: "",
  completed: false,
  type: "task",
};

const toDatetimeLocal = (value: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
};

export const CreateTaskModal = ({ isOpen, taskToEdit, onClose }: CreateTaskModalProps) => {
  const { subjects, selectedSubjectId, addTask, updateTask, deleteTask } = useAcademic();
  const [form, setForm] = useState<TaskInput>(emptyForm);
  const [descriptionMode, setDescriptionMode] = useState<"edit" | "view">("edit");

  useModalBehavior({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDescriptionMode(taskToEdit ? "view" : "edit");

    if (taskToEdit) {
      setForm({
        title: taskToEdit.title,
        description: taskToEdit.description ?? "",
        subjectId: taskToEdit.subjectId,
        dueDate: toDatetimeLocal(taskToEdit.dueDate),
        completed: taskToEdit.completed,
        type: taskToEdit.type,
      });
      return;
    }

    setForm({
      ...emptyForm,
      subjectId: selectedSubjectId ?? subjects[0]?.id ?? "",
    });
  }, [isOpen, selectedSubjectId, subjects, taskToEdit]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim() || !form.subjectId || !form.dueDate) {
      return;
    }

    const payload: TaskInput = {
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() ?? "",
      dueDate: new Date(form.dueDate).toISOString(),
    };

    if (taskToEdit) {
      updateTask(taskToEdit.id, payload);
    } else {
      addTask(payload);
    }

    onClose();
  };

  const handleDelete = () => {
    if (!taskToEdit) {
      return;
    }

    deleteTask(taskToEdit.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              {taskToEdit ? "Editar" : "Nueva"} tarea
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">
              {taskToEdit ? "Actualiza tu pendiente" : "Registra una tarea o evaluacion"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-100 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-200"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="overflow-y-auto rounded-[1.75rem] border border-stone-200 bg-stone-50/70 p-5">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Titulo</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                    placeholder="Ej: Entrega informe parcial"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Asignatura</span>
                  <select
                    value={form.subjectId}
                    onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  >
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Tipo</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, type: event.target.value as TaskInput["type"] }))
                    }
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  >
                    <option value="task">Tarea</option>
                    <option value="exam">Prueba</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.completed}
                    onChange={(event) => setForm((current) => ({ ...current, completed: event.target.checked }))}
                    className="h-4 w-4 rounded border-stone-300 text-stone-900"
                  />
                  <span className="text-sm font-medium text-stone-700">Marcar como completada</span>
                </label>
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-[1.75rem] border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Descripcion</p>
                  <h3 className="mt-1 text-lg font-semibold text-stone-900">Notas en Markdown</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-stone-100 p-1">
                  <button
                    type="button"
                    onClick={() => setDescriptionMode("edit")}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      descriptionMode === "edit" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                    }`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescriptionMode("view")}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      descriptionMode === "view" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                    }`}
                  >
                    Vista
                  </button>
                </div>
              </div>

              <div className="mt-4 min-h-0 flex-1">
                {descriptionMode === "edit" ? (
                  <label className="flex h-full min-h-0 flex-col">
                    <span className="mb-2 block text-sm font-medium text-stone-700">Contenido Markdown</span>
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      rows={16}
                      className="min-h-[22rem] w-full flex-1 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-400"
                      placeholder={"Ejemplo:\n# Avance\n- Comprar materiales\n- Tomar fotos\n**Importante** revisar ajustes"}
                    />
                  </label>
                ) : (
                  <div className="h-full max-h-[28rem] min-h-[22rem] overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
                    {form.description?.trim() ? (
                      <div
                        className="markdown-preview space-y-3 text-sm leading-7 text-stone-700"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(form.description) }}
                      />
                    ) : (
                      <p className="text-sm text-stone-500">Todavia no hay descripcion para esta tarea.</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-stone-200 bg-white pt-5">
            {taskToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="mr-auto rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                Eliminar tarea
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              {taskToEdit ? "Guardar cambios" : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
