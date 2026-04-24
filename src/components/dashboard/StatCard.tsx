import { shellCardClass } from "../../constants/app";

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <article className={`${shellCardClass} h-full overflow-hidden p-4 sm:p-5`}>
      <div className={`mb-4 h-2 w-24 rounded-full ${accent}`} />
      <p className="text-sm font-medium text-rose-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-rose-950 xl:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-5 text-rose-700/80">{hint}</p>
    </article>
  );
}
