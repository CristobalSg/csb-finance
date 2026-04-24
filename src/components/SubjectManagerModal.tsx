import { useEffect, useState } from "react";

import { useAcademic } from "../context/AcademicContext";
import { deleteFilesBySubject } from "../lib/files-db";
import { useModalBehavior } from "../hooks/useModalBehavior";

interface SubjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubjectManagerModal = ({ isOpen, onClose }: SubjectManagerModalProps) => {
  const { subjects, tasks, addSubject, updateSubject, deleteSubject } = useAcademic();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useModalBehavior({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedSubjectId(null);
    setName("");
    setCode("");
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;

  const startCreate = () => {
    setSelectedSubjectId(null);
    setName("");
    setCode("");
  };

  const startEdit = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId);

    if (!subject) {
      return;
    }

    setSelectedSubjectId(subject.id);
    setName(subject.name);
    setCode(subject.code);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName || !trimmedCode) {
      return;
    }

    if (selectedSubject) {
      updateSubject(selectedSubject.id, { name: trimmedName, code: trimmedCode });
    } else {
      addSubject({ name: trimmedName, code: trimmedCode });
    }

    startCreate();
  };

  const handleDelete = async () => {
    if (!selectedSubject) {
      return;
    }

    await deleteFilesBySubject(selectedSubject.id).catch(() => undefined);
    deleteSubject(selectedSubject.id);
    startCreate();
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
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Asignaturas</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">Crear, editar o eliminar</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-200"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid min-h-0 flex-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="overflow-y-auto rounded-[1.75rem] border border-stone-200 bg-stone-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-stone-900">Listado</h3>
              <button
                type="button"
                onClick={startCreate}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                Nueva
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {subjects.map((subject) => {
                const pendingCount = tasks.filter((task) => task.subjectId === subject.id && !task.completed).length;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => startEdit(subject.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedSubjectId === subject.id
                        ? "text-stone-900"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                    style={
                      selectedSubjectId === subject.id
                        ? {
                            borderColor: subject.color,
                            backgroundColor: `${subject.color}18`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full"
                            style={{ backgroundColor: subject.color, boxShadow: `0 0 0 4px ${subject.color}1f` }}
                          />
                          <p className="font-medium">{subject.name}</p>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">{subject.code}</p>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: `${subject.color}1a`,
                          color: subject.color,
                        }}
                      >
                        {pendingCount}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-stone-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              {selectedSubject ? "Editar asignatura" : "Nueva asignatura"}
            </p>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Nombre</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Ej: Desarrollo de Software V"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Codigo</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Ej: DSW-V"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {selectedSubject && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="mr-auto rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50"
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                onClick={startCreate}
                className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                {selectedSubject ? "Guardar cambios" : "Crear asignatura"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
