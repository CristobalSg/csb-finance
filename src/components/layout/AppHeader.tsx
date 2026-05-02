import { useEffect, useRef, useState } from "react";

import { shellCardClass, systemName } from "../../constants/app";
import { DotsIcon, MoonIcon, SunIcon } from "../icons";

export function AppHeader({
  isDarkMode,
  onExport,
  onClearAllData,
  onToggleDarkMode,
}: {
  isDarkMode: boolean;
  onExport: () => void;
  onClearAllData: () => void;
  onToggleDarkMode: () => void;
}) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!optionsRef.current?.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOptionsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className={`${shellCardClass} z-20 mb-4 border-rose-100/80 bg-white/75 py-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Gestion diaria de finanzas</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-rose-950 sm:text-3xl">{systemName}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? "Activar modo claro" : "Activar modo oscuro"}
            title={isDarkMode ? "Activar modo claro" : "Activar modo oscuro"}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-800 shadow-sm hover:border-fuchsia-200 hover:text-fuchsia-700"
          >
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            type="button"
            onClick={onExport}
            className="rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
          >
            Exportar backup JSON
          </button>

          <div ref={optionsRef} className="relative">
            <button
              type="button"
              onClick={() => setIsOptionsOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isOptionsOpen}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm hover:border-fuchsia-200 hover:text-fuchsia-700"
            >
              <DotsIcon />
              Opciones
            </button>

            {isOptionsOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-64 rounded-[1.5rem] border border-rose-100 bg-white p-2 shadow-[0_24px_80px_var(--app-shadow)]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    onClearAllData();
                  }}
                  className="flex w-full rounded-[1rem] px-4 py-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-900"
                >
                  Borrar todos los datos de la app
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
