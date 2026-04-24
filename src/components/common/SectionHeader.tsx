import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">{eyebrow}</p>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-rose-950 sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-rose-700/80 sm:text-base">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
