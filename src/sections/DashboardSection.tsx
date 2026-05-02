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
          hint={`Ventas registradas: ${formatNumber(totals.salesCount)} · Cobrado: ${formatCurrency(totals.collectedIncome)} · Pendiente: ${formatCurrency(totals.pendingIncome)}`}
          accent="bg-gradient-to-r from-fuchsia-500 to-rose-400"
        />
        <StatCard
          label="Egresos totales"
          value={formatCurrency(totals.expenses)}
          hint={`Registros: ${formatNumber(totals.purchasesCount)} · Inversion inicial: ${formatCurrency(totals.initialInvestment)}`}
          accent="bg-gradient-to-r from-rose-300 to-rose-500"
        />
        <StatCard
          label="Inversion inicial"
          value={formatCurrency(totals.initialInvestment)}
          hint={`Registros de inversion: ${formatNumber(totals.investmentCount)} · Inventario valorizado: ${formatCurrency(totals.inventoryValue)}`}
          accent="bg-gradient-to-r from-amber-300 to-rose-400"
        />
        <StatCard
          label="Gasto operativo"
          value={formatCurrency(totals.operatingExpenses)}
          hint={`Gastos: ${formatNumber(totals.expenseCount)} · Egresos totales menos inversion inicial`}
          accent="bg-gradient-to-r from-pink-300 to-rose-500"
        />
        <StatCard
          label="Dinero real disponible"
          value={formatCurrency(totals.net)}
          hint="Formula: ventas cobradas - gasto operativo."
          accent="bg-gradient-to-r from-pink-400 to-fuchsia-600"
        />
      </div>

      <div data-print-grid="metrics-secondary" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Utilidad total"
          value={formatCurrency(totals.utilityTotal)}
          hint="Ventas totales menos gasto operativo."
          accent="bg-gradient-to-r from-emerald-400 to-teal-500"
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
        <StatCard
          label="ROI"
          value={formatPercent(totals.roi)}
          hint="Utilidad total dividida por inversion inicial."
          accent="bg-gradient-to-r from-violet-400 to-fuchsia-500"
        />
      </div>

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
