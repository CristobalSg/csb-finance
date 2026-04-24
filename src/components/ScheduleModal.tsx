import scheduleImage from "../../img/horario.png";
import { useModalBehavior } from "../hooks/useModalBehavior";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScheduleModal = ({ isOpen, onClose }: ScheduleModalProps) => {
  useModalBehavior({ isOpen, onClose });

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Horario</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">Vista completa del horario academico</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-200"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-stone-50">
          <img src={scheduleImage} alt="Horario academico" className="h-auto w-full object-contain" />
        </div>
      </div>
    </div>
  );
};
