import { useEffect, useState } from "react";

import { ErrorBanner, ToastBanner } from "./components/common/FeedbackBanners";
import { AppSidebar } from "./components/layout/AppSidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { navItems } from "./constants/app";
import type { OrderMenuCategoryId } from "./data/order-menu";
import { useFinanceData } from "./hooks/useFinanceData";
import { IngredientControlPage } from "./pages/IngredientControlPage";
import { DashboardSection } from "./sections/DashboardSection";
import { EventsSection } from "./sections/EventsSection";
import { HomeSection } from "./sections/HomeSection";
import { InventorySection } from "./sections/InventorySection";
import { PurchasesSection } from "./sections/PurchasesSection";
import { SalesSection } from "./sections/SalesSection";
import { SettingsSection } from "./sections/SettingsSection";

export default function App() {
  const finance = useFinanceData();
  const [activeSection, setActiveSection] = useState<(typeof navItems)[number]["id"]>("home");
  const [activeMenuCategory, setActiveMenuCategory] = useState<OrderMenuCategoryId>("offers");
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
    home: <HomeSection activeMenuCategory={activeMenuCategory} onRegisterSale={finance.addSaleFromOrder} />,
    dashboard: (
      <DashboardSection
        totals={finance.totals}
        chartData={finance.chartData}
      />
    ),
    movimientos: (
      <PurchasesSection
        loading={finance.loading}
        purchases={finance.purchases}
        inventory={finance.inventory}
        form={finance.purchaseForm}
        onChange={finance.setPurchaseForm}
        previewTotal={finance.purchasePreviewTotal}
        isEditing={Boolean(finance.editingPurchaseId)}
        onSubmit={finance.handlePurchaseSubmit}
        onEdit={finance.startEditPurchase}
        onCancelEdit={finance.cancelEditPurchase}
        onDelete={(id) => void finance.handleDelete("purchases", id, true)}
        onExport={finance.exportPurchasesCsv}
        onImport={finance.importPurchasesCsv}
      />
    ),
    ventas: (
      <SalesSection
        loading={finance.loading}
        sales={finance.sales}
        onDelete={(id) => void finance.handleDelete("sales", id)}
        onUpdateStatus={(id, status, paymentAmounts) => void finance.updateSaleStatus(id, status, paymentAmounts)}
        onUpdateSale={(id, updates) => void finance.updateSaleDetails(id, updates)}
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
    eventos: <EventsSection />,
    configuracion: (
      <SettingsSection
        isDarkMode={isDarkMode}
        onExport={finance.exportBackup}
        onClearAllData={() => void finance.handleClearAllData()}
        onToggleDarkMode={() => setIsDarkMode((current) => !current)}
      />
    ),
  } as const;

  return (
    <main className="app-shell h-screen w-screen overflow-hidden text-rose-950">
      <div className="flex h-full w-full flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <div data-print-layout className="min-h-0 flex-1 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
          <div className="hidden min-h-0 lg:block" data-print-hidden>
            <AppSidebar
              items={navItems}
              activeItem={activeSection}
              activeMenuCategory={activeMenuCategory}
              onSelect={setActiveSection}
              onSelectMenuCategory={setActiveMenuCategory}
            />
          </div>

          <div data-print-content className="min-w-0 min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0" data-print-hidden>
                <MobileNav items={navItems} activeItem={activeSection} onSelect={setActiveSection} />
                <ToastBanner toast={finance.toast} />
                <ErrorBanner error={finance.error} />
              </div>
              <div className={`min-h-0 flex-1 ${activeSection === "home" ? "overflow-hidden" : "overflow-auto"}`}>
                <div className={`flex flex-col ${activeSection === "home" ? "h-full min-h-0" : "min-h-full"}`}>
                  <div className="min-h-0 flex-1">{contentBySection[activeSection]}</div>
                  {activeSection === "home" ? null : (
                    <footer data-print-hidden className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/70 px-5 py-4 text-sm text-rose-700 shadow-[0_18px_50px_var(--app-shadow)] backdrop-blur">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-rose-900">Finanzas Ceeseburgers C&K</p>
                        <p>Resumen local de movimientos, ventas e inventario guardado en este dispositivo.</p>
                      </div>
                    </footer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
