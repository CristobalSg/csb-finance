import { useAcademic } from "../context/AcademicContext";

interface SubjectSidebarProps {
  onManageSubjects: () => void;
}

export const SubjectSidebar = ({ onManageSubjects }: SubjectSidebarProps) => {
  const { subjects, tasks, selectedSubjectId, selectSubject } = useAcademic();

  const pendingBySubject = new Map(
    subjects.map((subject) => [
      subject.id,
      tasks.filter((task) => task.subjectId === subject.id && !task.completed).length,
    ]),
  );

  return (
    <aside className="top-5 self-start rounded-[2rem] border border-stone-200 bg-white/85 p-5 shadow-[0_24px_80px_rgba(120,53,15,0.08)] backdrop-blur xl:sticky">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => selectSubject(null)}
          className={`flex flex-1 items-center justify-between rounded-2xl border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(120,53,15,0.10)] ${
            selectedSubjectId === null
              ? "border-stone-900 bg-stone-900 text-white"
              : "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-stone-100"
          }`}
        >
          <span className="font-medium">Todas las asignaturas</span>
        </button>
        <button
          type="button"
          onClick={onManageSubjects}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-white text-xl font-semibold text-stone-700 transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-stone-50 hover:shadow-[0_16px_35px_rgba(120,53,15,0.10)]"
          aria-label="Gestionar asignaturas"
        >
          +
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            onClick={() => selectSubject(subject.id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(120,53,15,0.10)] ${
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
                {pendingBySubject.get(subject.id) ?? 0}
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
};
