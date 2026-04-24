import { useMemo, useRef, useState } from "react";

import { useAcademic } from "../context/AcademicContext";
import { formatDateTime } from "../lib/date";
import { useSubjectFiles } from "../hooks/useSubjectFiles";

export const FileUploader = () => {
  const { selectedSubjectId, subjects } = useAcademic();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { files, isLoading, uploadFiles, removeFile } = useSubjectFiles(selectedSubjectId);

  const currentSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects],
  );

  const handleFiles = async (fileList: FileList | File[]) => {
    if (!fileList.length) {
      return;
    }

    await uploadFiles(fileList);
  };

  const handleDownload = (file: File, name: string) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(120,53,15,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Archivos</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            {currentSubject ? `Material de ${currentSubject.name}` : "Selecciona una asignatura"}
          </h2>
        </div>
        {currentSubject && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Subir archivos
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            void handleFiles(event.target.files);
            event.target.value = "";
          }
        }}
      />

      {currentSubject ? (
        <>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={`mt-6 rounded-[1.75rem] border-2 border-dashed px-6 py-10 text-center transition ${
              isDragging
                ? "border-amber-400 bg-amber-50"
                : "border-stone-300 bg-stone-50 text-stone-500"
            }`}
          >
            <p className="text-base font-medium text-stone-900">Arrastra archivos aqui o usa el boton de subida</p>
            <p className="mt-2 text-sm text-stone-500">Los archivos se guardan localmente en tu navegador.</p>
          </div>

          <div className="mt-6 space-y-3">
            {isLoading ? (
              <div className="rounded-2xl bg-stone-50 px-4 py-6 text-sm text-stone-500">Cargando archivos...</div>
            ) : files.length > 0 ? (
              files.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
                >
                  <div>
                    <p className="font-medium text-stone-900">{item.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{formatDateTime(item.uploadedAt)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleDownload(item.file, item.name)}
                      className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
                    >
                      Descargar
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeFile(item.id)}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                Todavia no hay archivos cargados para esta asignatura.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-stone-500">
          Elige una asignatura desde la barra lateral para administrar archivos.
        </div>
      )}
    </section>
  );
};
