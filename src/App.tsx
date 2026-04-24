import { useEffect, useState } from "react";

import { ErrorBanner, ToastBanner } from "./components/common/FeedbackBanners";
import { AppHeader } from "./components/layout/AppHeader";
import { AppSidebar } from "./components/layout/AppSidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { navItems } from "./constants/app";
import { useFinanceData } from "./hooks/useFinanceData";
import { IngredientControlPage } from "./pages/IngredientControlPage";
import { DashboardSection } from "./sections/DashboardSection";
import { HomeSection } from "./sections/HomeSection";
import { InventorySection } from "./sections/InventorySection";
import { PurchasesSection } from "./sections/PurchasesSection";
import { SalesSection } from "./sections/SalesSection";

export default function App() {
  const finance = useFinanceData();
  const [activeSection, setActiveSection] = useState<(typeof navItems)[number]["id"]>("home");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      return true;
    }

    if (savedTheme === "light") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const contentBySection = {
    home: <HomeSection onRegisterSale={finance.addSaleFromOrder} />,
    dashboard: (
      <DashboardSection
        totals={finance.totals}
        chartData={finance.chartData}
      />
    ),
    compras: (
      <PurchasesSection
        loading={finance.loading}
        purchases={finance.purchases}
        inventory={finance.inventory}
        form={finance.purchaseForm}
        onChange={finance.setPurchaseForm}
        previewTotal={finance.purchasePreviewTotal}
        onSubmit={finance.handlePurchaseSubmit}
        onDelete={(id) => void finance.handleDelete("purchases", id)}
        onExport={finance.exportPurchasesCsv}
        onImport={finance.importPurchasesCsv}
      />
    ),
    ventas: (
      <SalesSection
        loading={finance.loading}
        sales={finance.sales}
        onDelete={(id) => void finance.handleDelete("sales", id)}
        onUpdateStatus={(id, status) => void finance.updateSaleStatus(id, status)}
        onExport={finance.exportSalesCsv}
        onImport={finance.importSalesCsv}
      />
    ),
    inventario: (
      <InventorySection
        loading={finance.loading}
        inventory={finance.inventory}
        onDelete={(id) => void finance.handleDelete("inventory", id)}
        onExport={finance.exportInventoryCsv}
      />
    ),
    ingredientes: <IngredientControlPage />,
  } as const;

  return (
    <main className="app-shell h-screen w-screen overflow-hidden text-rose-950">
      <div className="flex h-full w-full flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <div className="shrink-0" data-print-hidden>
          <AppHeader
            isDarkMode={isDarkMode}
            onExport={finance.exportBackup}
            onClearAllData={() => void finance.handleClearAllData()}
            onToggleDarkMode={() => setIsDarkMode((current) => !current)}
          />
        </div>

        <div data-print-layout className="min-h-0 flex-1 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
          <div className="hidden min-h-0 lg:block" data-print-hidden>
            <AppSidebar items={navItems} activeItem={activeSection} onSelect={setActiveSection} />
          </div>

          <div data-print-content className="min-w-0 min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0" data-print-hidden>
                <MobileNav items={navItems} activeItem={activeSection} onSelect={setActiveSection} />
                <ToastBanner toast={finance.toast} />
                <ErrorBanner error={finance.error} />
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="flex min-h-full flex-col">
                  <div className="min-h-0 flex-1">{contentBySection[activeSection]}</div>
                  <footer data-print-hidden className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/70 px-5 py-4 text-sm text-rose-700 shadow-[0_18px_50px_rgba(190,24,93,0.08)] backdrop-blur">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-rose-900">Finanzas Ceeseburgers C&K</p>
                      <p>Resumen local de compras, ventas e inventario guardado en este dispositivo.</p>
                    </div>
                  </footer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
