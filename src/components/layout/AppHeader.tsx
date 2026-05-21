import { shellCardClass, systemName } from "../../constants/app";

export function AppHeader() {
  return (
    <header className={`${shellCardClass} z-20 mb-4 border-rose-100/80 bg-white/75 py-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Gestion diaria de finanzas</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-rose-950 sm:text-3xl">{systemName}</h1>
        </div>
      </div>
    </header>
  );
}
