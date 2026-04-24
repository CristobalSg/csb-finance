import { shellCardClass } from "../../constants/app";
import { formatCurrency } from "../../lib/format";

export function GrowthInsightsCard({
  averageDailyIncome,
  averageDailyExpense,
  averageDailyUtility,
  activeDays,
}: {
  averageDailyIncome: number;
  averageDailyExpense: number;
  averageDailyUtility: number;
  activeDays: number;
}) {
  const projectedWeeklyUtility = averageDailyUtility * 7;

  const metrics = [
    {
      label: "Ventas diarias",
      value: formatCurrency(averageDailyIncome),
      hint: "Promedio por dia con actividad registrada",
    },
    {
      label: "Gastos diarios",
      value: formatCurrency(averageDailyExpense),
      hint: "Promedio diario de gasto operativo",
    },
    {
      label: "Utilidad diaria",
      value: formatCurrency(averageDailyUtility),
      hint: "Ventas diarias menos gasto operativo diario",
    },
    {
      label: "Proyeccion 7 dias",
      value: formatCurrency(projectedWeeklyUtility),
      hint: `Basada en ${activeDays} dias con actividad registrada`,
    },
  ];

  return (
    <article data-print-panel className={`${shellCardClass} flex min-h-[28rem] flex-col space-y-4 xl:min-h-0`}>
      <div>
        <p className="text-sm font-medium text-rose-500">Promedios diarios</p>
        <p className="mt-1 text-sm text-rose-700/80">
          Referencias automaticas calculadas sobre los dias con actividad registrada en el sistema.
        </p>
      </div>

      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[1.5rem] border border-rose-100 bg-rose-50/60 p-4">
            <p className="text-sm font-medium text-rose-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-950">{metric.value}</p>
            <p className="mt-2 text-sm leading-5 text-rose-700/80">{metric.hint}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
