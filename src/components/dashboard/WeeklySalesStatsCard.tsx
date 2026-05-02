import { shellCardClass } from "../../constants/app";
import { formatCurrency, formatNumber } from "../../lib/format";
import type { WeeklySalesStats } from "../../types";

const metricLabels: { key: keyof Pick<WeeklySalesStats, "burgers" | "fries" | "drinks" | "nuggets" | "sauces" | "other">; label: string }[] = [
  { key: "burgers", label: "Hamburguesas" },
  { key: "fries", label: "Papitas" },
  { key: "drinks", label: "Bebidas" },
  { key: "nuggets", label: "Nuggets" },
  { key: "sauces", label: "Salsas" },
  { key: "other", label: "Otros" },
];

const renderBreakdown = (items: { name: string; quantity: number }[], emptyMessage: string) =>
  items.length === 0 ? (
    <p className="text-sm text-rose-700/80">{emptyMessage}</p>
  ) : (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <div key={item.name} className="flex justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-rose-800">{item.name}</span>
          <span className="shrink-0 font-bold text-rose-950">{formatNumber(item.quantity)}</span>
        </div>
      ))}
    </div>
  );

export function WeeklySalesStatsCard({ weeks }: { weeks: WeeklySalesStats[] }) {
  return (
    <article data-print-panel className={`${shellCardClass} space-y-4`}>
      <div>
        <p className="text-sm font-medium text-rose-500">Ventas por semana</p>
        <p className="mt-1 text-sm text-rose-700/80">
          Resumen agrupado por semanas de atencion jueves a domingo.
        </p>
      </div>

      {weeks.length === 0 ? (
        <div className="rounded-[1.5rem] bg-rose-50 px-4 py-6 text-sm text-rose-700">
          Aun no hay ventas para calcular estadisticas semanales.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {weeks.slice(0, 6).map((week) => (
            <section key={week.weekKey} className="rounded-[1.5rem] border border-rose-100 bg-rose-50/60 p-4">
              <div className="flex flex-col gap-2 border-b border-rose-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-rose-950">{week.label}</h3>
                  <p className="mt-1 text-sm text-rose-700/80">
                    {formatNumber(week.salesCount)} ventas · {formatCurrency(week.income)}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-700">
                  {formatNumber(week.burgers)} burgers
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {metricLabels.map((metric) => (
                  <div key={metric.key} className="rounded-[1rem] bg-white/75 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">{metric.label}</p>
                    <p className="mt-1 text-xl font-black text-rose-950">{formatNumber(week[metric.key])}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-[1rem] bg-white/75 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Productos</p>
                  {renderBreakdown(week.products, "Sin productos.")}
                </div>
                <div className="rounded-[1rem] bg-white/75 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Bebidas</p>
                  {renderBreakdown(week.drinksBreakdown, "Sin bebidas.")}
                </div>
                <div className="rounded-[1rem] bg-white/75 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Salsas</p>
                  {renderBreakdown(week.saucesBreakdown, "Sin salsas.")}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
