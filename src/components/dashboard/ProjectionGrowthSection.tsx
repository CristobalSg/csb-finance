import { useState } from "react";

import { shellCardClass } from "../../constants/app";
import { formatCurrency, formatPercent } from "../../lib/format";

type ProjectionSummary = {
  label: string;
  sales: number;
  expenses: number;
  utility: number;
};

const parseOptionalNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampDays = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildProjection = ({
  days,
  growthRate,
  averageDailyIncome,
  averageDailyExpense,
  averageDailyUtility,
}: {
  days: number;
  growthRate: number | null;
  averageDailyIncome: number;
  averageDailyExpense: number;
  averageDailyUtility: number;
}) => {
  const multiplier = growthRate === null ? 1 : 1 + growthRate / 100;

  return {
    days,
    growthRate,
    sales: averageDailyIncome * days * multiplier,
    expenses: averageDailyExpense * days * multiplier,
    utility: averageDailyUtility * days * multiplier,
  };
};

export function ProjectionGrowthSection({
  currentIncome,
  currentExpenses,
  currentUtility,
  averageDailyIncome,
  averageDailyExpense,
  averageDailyUtility,
  initialInvestment,
}: {
  currentIncome: number;
  currentExpenses: number;
  currentUtility: number;
  averageDailyIncome: number;
  averageDailyExpense: number;
  averageDailyUtility: number;
  initialInvestment: number;
}) {
  const [twoWeeksDaysInput, setTwoWeeksDaysInput] = useState("14");
  const [yearDaysInput, setYearDaysInput] = useState("365");
  const [growthRateInput, setGrowthRateInput] = useState("");

  const growthRate = parseOptionalNumber(growthRateInput);
  const twoWeeksDays = clampDays(twoWeeksDaysInput, 14);
  const yearDays = clampDays(yearDaysInput, 365);

  const twoWeeksProjection = buildProjection({
    days: twoWeeksDays,
    growthRate,
    averageDailyIncome,
    averageDailyExpense,
    averageDailyUtility,
  });

  const yearProjection = buildProjection({
    days: yearDays,
    growthRate,
    averageDailyIncome,
    averageDailyExpense,
    averageDailyUtility,
  });

  const accumulatedTwoWeeksUtility = currentUtility + twoWeeksProjection.utility;
  const projectedYearRoi = initialInvestment > 0 ? (currentUtility + yearProjection.utility) / initialInvestment : 0;

  const chartSeries: ProjectionSummary[] = [
    { label: "Actual", sales: currentIncome, expenses: currentExpenses, utility: currentUtility },
    { label: `${twoWeeksDays} dias`, sales: twoWeeksProjection.sales, expenses: twoWeeksProjection.expenses, utility: twoWeeksProjection.utility },
    { label: `${yearDays} dias`, sales: yearProjection.sales, expenses: yearProjection.expenses, utility: yearProjection.utility },
  ];

  const highestValue = Math.max(1, ...chartSeries.flatMap((item) => [item.sales, item.expenses, Math.max(0, item.utility)]));

  return (
    <article data-print-panel className={`${shellCardClass} flex flex-col space-y-4`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-rose-500">Proyeccion de crecimiento</p>
          <p className="mt-1 max-w-4xl text-sm text-rose-700/80">
            Si no ingresas tasa, el sistema proyecta crecimiento lineal usando el promedio diario actual. Si ingresas tasa,
            aplica ese ajuste a ambas proyecciones.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Dias cortos</span>
            <input
              type="number"
              min="1"
              value={twoWeeksDaysInput}
              onChange={(event) => setTwoWeeksDaysInput(event.target.value)}
              className="w-full rounded-[1rem] border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Dias largos</span>
            <input
              type="number"
              min="1"
              value={yearDaysInput}
              onChange={(event) => setYearDaysInput(event.target.value)}
              className="w-full rounded-[1rem] border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Crecimiento %</span>
            <input
              type="number"
              step="0.1"
              value={growthRateInput}
              onChange={(event) => setGrowthRateInput(event.target.value)}
              className="w-full rounded-[1rem] border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
              placeholder="Opcional"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-rose-100 bg-rose-50/60 p-5">
          <p className="text-sm font-medium text-rose-500">Proyeccion 2 semanas</p>
          <p className="mt-1 text-sm text-rose-700/80">Escenario proyectado a {twoWeeksDays} dias.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Ventas</p>
              <p className="mt-1 text-xl font-bold text-rose-950">{formatCurrency(twoWeeksProjection.sales)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Gastos</p>
              <p className="mt-1 text-xl font-bold text-rose-950">{formatCurrency(twoWeeksProjection.expenses)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Utilidad</p>
              <p className="mt-1 text-xl font-bold text-fuchsia-700">{formatCurrency(twoWeeksProjection.utility)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Acumulado</p>
              <p className="mt-1 text-xl font-bold text-rose-950">{formatCurrency(accumulatedTwoWeeksUtility)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-rose-100 bg-rose-50/60 p-5">
          <p className="text-sm font-medium text-rose-500">Proyeccion 1 ano</p>
          <p className="mt-1 text-sm text-rose-700/80">Escenario proyectado a {yearDays} dias.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Ventas</p>
              <p className="mt-1 text-xl font-bold text-rose-950">{formatCurrency(yearProjection.sales)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Gastos</p>
              <p className="mt-1 text-xl font-bold text-rose-950">{formatCurrency(yearProjection.expenses)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">Utilidad</p>
              <p className="mt-1 text-xl font-bold text-fuchsia-700">{formatCurrency(yearProjection.utility)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-rose-500">ROI proyectado</p>
              <p className="mt-1 text-xl font-bold text-rose-950">{formatPercent(projectedYearRoi)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-rose-100 bg-white/70 p-5">
        <p className="text-sm font-medium text-rose-500">Comparativo actual vs proyecciones</p>
        <p className="mt-1 text-sm text-rose-700/80">Ventas, gastos y utilidad en el escenario actual, corto y largo plazo.</p>

        <div data-print-projection-chart className="mt-4 overflow-x-auto">
          <div className="grid min-w-[32rem] grid-cols-3 gap-4">
            {chartSeries.map((series) => (
              <div key={series.label} className="rounded-[1.5rem] bg-rose-50/60 p-4">
                <p className="text-sm font-semibold text-rose-900">{series.label}</p>
                <div className="mt-4 flex h-52 items-end justify-center gap-3 rounded-[1.25rem] bg-white/80 p-4">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-5 rounded-full bg-fuchsia-600"
                      style={{ height: `${Math.max(10, (series.sales / highestValue) * 100)}%` }}
                      title={`Ventas ${formatCurrency(series.sales)}`}
                    />
                    <span className="text-[11px] text-fuchsia-700">Ventas</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-5 rounded-full bg-rose-300"
                      style={{ height: `${Math.max(10, (series.expenses / highestValue) * 100)}%` }}
                      title={`Gastos ${formatCurrency(series.expenses)}`}
                    />
                    <span className="text-[11px] text-rose-700">Gastos</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-5 rounded-full bg-emerald-400"
                      style={{ height: `${Math.max(10, (Math.max(0, series.utility) / highestValue) * 100)}%` }}
                      title={`Utilidad ${formatCurrency(series.utility)}`}
                    />
                    <span className="text-[11px] text-emerald-700">Utilidad</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-rose-700">
                  <p>Ventas: {formatCurrency(series.sales)}</p>
                  <p>Gastos: {formatCurrency(series.expenses)}</p>
                  <p>Utilidad: {formatCurrency(series.utility)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
