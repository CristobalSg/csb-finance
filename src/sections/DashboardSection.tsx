import { useRef } from "react";

import { ChartCard } from "../components/dashboard/ChartCard";
import { GrowthInsightsCard } from "../components/dashboard/GrowthInsightsCard";
import { ProjectionGrowthSection } from "../components/dashboard/ProjectionGrowthSection";
import { ProductMetricsTable } from "../components/dashboard/ProductMetricsTable";
import { StatCard } from "../components/dashboard/StatCard";
import { WeeklySalesStatsCard } from "../components/dashboard/WeeklySalesStatsCard";
import { formatCurrency, formatNumber, formatPercent } from "../lib/format";
import type { WeeklySalesStats } from "../types";

export function DashboardSection({
  totals,
  chartData,
}: {
  totals: {
    income: number;
    collectedIncome: number;
    cashIncome: number;
    transferIncome: number;
    pendingIncome: number;
    allTimeIncome: number;
    allTimeCollectedIncome: number;
    allTimePendingIncome: number;
    allTimeExpenses: number;
    allTimeBusinessPurchases: number;
    allTimeOperatingExpenses: number;
    allTimeInitialInvestment: number;
    allTimeUtility: number;
    allTimeSimpleProfit: number;
    allTimeSalesCount: number;
    allTimeMovementsCount: number;
    cashExpenses: number;
    debitExpenses: number;
    availableCash: number;
    availableDebit: number;
    availableTotal: number;
    initialCashBalance: number;
    initialDebitBalance: number;
    controlStartDate: string;
    salesCount: number;
    expenses: number;
    purchasesCount: number;
    initialInvestment: number;
    operatingExpenses: number;
    investmentCount: number;
    expenseCount: number;
    inventoryValue: number;
    utilityTotal: number;
    profitability: number;
    marginOnSpend: number;
    roi: number;
    averageDailyIncome: number;
    averageDailyExpense: number;
    averageDailyUtility: number;
    activeDays: number;
    productMetrics: {
      name: string;
      unitsSold: number;
      cost: number;
      price: number;
      marginUnit: number;
      marginPercent: number;
      absoluteProfit: number;
    }[];
    topProductsByMargin: {
      name: string;
      unitsSold: number;
      cost: number;
      price: number;
      marginUnit: number;
      marginPercent: number;
      absoluteProfit: number;
    }[];
    topProductsByProfit: {
      name: string;
      unitsSold: number;
      cost: number;
      price: number;
      marginUnit: number;
      marginPercent: number;
      absoluteProfit: number;
    }[];
    weeklyStats: WeeklySalesStats[];
    net: number;
    expectedCash: number;
  };
  chartData: { date: string; income: number; expense: number }[];
}) {
  const exportRef = useRef<HTMLElement | null>(null);

  const handleExportPdf = () => {
    if (!exportRef.current) {
      return;
    }

    const cleanup = () => {
      document.body.classList.remove("printing-dashboard");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("printing-dashboard");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 1000);
    window.print();
  };

  return (
    <section ref={exportRef} id="dashboard" data-print-dashboard className="flex h-full min-h-0 flex-col space-y-4 overflow-auto pr-1">
      <div className="flex justify-end" data-print-hidden>
        <button
          type="button"
          onClick={handleExportPdf}
          className="rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
        >
          Exportar dashboard PDF
        </button>
      </div>

      <div data-print-grid="metrics-primary" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Ingresos totales"
          value={formatCurrency(totals.income)}
          hint={`Desde ${totals.controlStartDate} · Efectivo: ${formatCurrency(totals.cashIncome)} · Debito: ${formatCurrency(totals.transferIncome)} · Pendiente: ${formatCurrency(totals.pendingIncome)}`}
          accent="bg-gradient-to-r from-fuchsia-500 to-rose-400"
        />
        <StatCard
          label="Egresos totales"
          value={formatCurrency(totals.expenses)}
          hint={`Efectivo: ${formatCurrency(totals.cashExpenses)} · Debito: ${formatCurrency(totals.debitExpenses)} · Registros: ${formatNumber(totals.purchasesCount)}`}
          accent="bg-gradient-to-r from-rose-300 to-rose-500"
        />
        <StatCard
          label="Inversion inicial"
          value={formatCurrency(totals.initialInvestment)}
          hint={`Solo inversion · Registros: ${formatNumber(totals.investmentCount)} · No descuenta del disponible`}
          accent="bg-gradient-to-r from-amber-300 to-rose-400"
        />
        <StatCard
          label="Disponible efectivo"
          value={formatCurrency(totals.availableCash)}
          hint={`Inicial: ${formatCurrency(totals.initialCashBalance)} · Ingresos: ${formatCurrency(totals.cashIncome)} · Egresos: ${formatCurrency(totals.cashExpenses)}`}
          accent="bg-gradient-to-r from-pink-300 to-rose-500"
        />
        <StatCard
          label="Disponible debito"
          value={formatCurrency(totals.availableDebit)}
          hint={`Inicial: ${formatCurrency(totals.initialDebitBalance)} · Ingresos: ${formatCurrency(totals.transferIncome)} · Egresos: ${formatCurrency(totals.debitExpenses)}`}
          accent="bg-gradient-to-r from-pink-400 to-fuchsia-600"
        />
      </div>

      <div data-print-grid="metrics-secondary" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Dinero real disponible"
          value={formatCurrency(totals.availableTotal)}
          hint="Efectivo disponible + debito disponible."
          accent="bg-gradient-to-r from-emerald-400 to-teal-500"
        />
        <StatCard
          label="Utilidad total"
          value={formatCurrency(totals.utilityTotal)}
          hint="Ingresos totales menos egresos, sin contar inversion."
          accent="bg-gradient-to-r from-lime-400 to-emerald-500"
        />
        <StatCard
          label="Rentabilidad"
          value={formatPercent(totals.profitability)}
          hint="Utilidad total dividida por ventas."
          accent="bg-gradient-to-r from-sky-400 to-cyan-500"
        />
        <StatCard
          label="Margen sobre gasto"
          value={formatPercent(totals.marginOnSpend)}
          hint="Utilidad total dividida por gasto operativo."
          accent="bg-gradient-to-r from-orange-300 to-rose-400"
        />
      </div>

      <section className="rounded-[1.5rem] border border-rose-100 bg-white/75 p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-rose-950">Resumen general historico</h3>
            <p className="text-sm text-rose-700/80">Vista completa de todo el tiempo. No usa la fecha de control de caja.</p>
          </div>
          <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
            Todo el tiempo
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Ingresos historicos"
            value={formatCurrency(totals.allTimeIncome)}
            hint={`Ventas: ${formatNumber(totals.allTimeSalesCount)} · Cobrado: ${formatCurrency(totals.allTimeCollectedIncome)} · Pendiente: ${formatCurrency(totals.allTimePendingIncome)}`}
            accent="bg-gradient-to-r from-fuchsia-500 to-rose-400"
          />
          <StatCard
            label="Egresos historicos"
            value={formatCurrency(totals.allTimeExpenses)}
            hint={`Movimientos: ${formatNumber(totals.allTimeMovementsCount)} · Sin contar inversion`}
            accent="bg-gradient-to-r from-rose-300 to-rose-500"
          />
          <StatCard
            label="Inversion historica"
            value={formatCurrency(totals.allTimeInitialInvestment)}
            hint="Solo movimientos marcados como inversion."
            accent="bg-gradient-to-r from-amber-300 to-rose-400"
          />
          <StatCard
            label="Utilidad historica"
            value={formatCurrency(totals.allTimeUtility)}
            hint="Ingresos historicos menos egresos historicos."
            accent="bg-gradient-to-r from-emerald-400 to-teal-500"
          />
          <StatCard
            label="Ganancia simple"
            value={formatCurrency(totals.allTimeSimpleProfit)}
            hint={`Ventas cobradas - compras negocio (${formatCurrency(totals.allTimeBusinessPurchases)}) - gastos operativos (${formatCurrency(totals.allTimeOperatingExpenses)})`}
            accent="bg-gradient-to-r from-lime-400 to-emerald-500"
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-rose-100 bg-white/75 p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-rose-950">Saldos iniciales</h3>
            <p className="text-sm text-rose-700/80">Base usada para calcular el disponible real desde la fecha de control.</p>
          </div>
          <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
            Desde {totals.controlStartDate}
          </span>
        </div>
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-rose-500">
              <tr>
                <th className="pb-3 pr-4 font-semibold">Campo</th>
                <th className="pb-3 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="text-rose-900">
              <tr className="border-t border-rose-100">
                <td className="py-3 pr-4 font-semibold">saldo_inicial_efectivo</td>
                <td className="py-3">{formatCurrency(totals.initialCashBalance)}</td>
              </tr>
              <tr className="border-t border-rose-100">
                <td className="py-3 pr-4 font-semibold">saldo_inicial_debito</td>
                <td className="py-3">{formatCurrency(totals.initialDebitBalance)}</td>
              </tr>
              <tr className="border-t border-rose-100">
                <td className="py-3 pr-4 font-semibold">fecha_inicio_control</td>
                <td className="py-3">{totals.controlStartDate}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div data-print-grid="analytics" className="min-h-0 flex-1 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard
          title="Movimiento de los ultimos 7 dias"
          subtitle="Comparacion diaria entre ingresos y gasto operativo. La inversion inicial no entra en este grafico para no distorsionar el dinero real disponible."
          data={chartData}
        />
        <GrowthInsightsCard
          averageDailyIncome={totals.averageDailyIncome}
          averageDailyExpense={totals.averageDailyExpense}
          averageDailyUtility={totals.averageDailyUtility}
          activeDays={totals.activeDays}
        />
      </div>

      <ProjectionGrowthSection
        currentIncome={totals.income}
        currentExpenses={totals.operatingExpenses}
        currentUtility={totals.utilityTotal}
        averageDailyIncome={totals.averageDailyIncome}
        averageDailyExpense={totals.averageDailyExpense}
        averageDailyUtility={totals.averageDailyUtility}
        initialInvestment={totals.initialInvestment}
      />

      <ProductMetricsTable
        items={totals.productMetrics}
        topByMargin={totals.topProductsByMargin}
        topByProfit={totals.topProductsByProfit}
      />

      <WeeklySalesStatsCard weeks={totals.weeklyStats} />
    </section>
  );
}
