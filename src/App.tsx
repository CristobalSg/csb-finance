import { useEffect, useState } from "react";

import { ErrorBanner, ToastBanner } from "./components/common/FeedbackBanners";
import { AppSidebar } from "./components/layout/AppSidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { navItems } from "./constants/app";
import { RefreshIcon, XIcon } from "./components/icons";
import type { OrderMenuCategoryId } from "./data/order-menu";
import { useFinanceData } from "./hooks/useFinanceData";
import { IngredientControlPage } from "./pages/IngredientControlPage";
import { OrdersManagementPage } from "./pages/OrdersManagementPage";
import { getValidReceiptLogoPath, receiptLogoPreferenceKey } from "./lib/receipt-settings";
import { DashboardSection } from "./sections/DashboardSection";
import { EventsSection } from "./sections/EventsSection";
import { HomeSection } from "./sections/HomeSection";
import { InventorySection } from "./sections/InventorySection";
import { PurchasesSection } from "./sections/PurchasesSection";
import { SalesSection } from "./sections/SalesSection";
import { SettingsSection, type AppTheme } from "./sections/SettingsSection";

const appThemes: AppTheme[] = ["light", "dark", "red-dark", "gray-dark"];

export default function App() {
  const finance = useFinanceData();
  const [activeSection, setActiveSection] = useState<(typeof navItems)[number]["id"]>("home");
  const [activeMenuCategory, setActiveMenuCategory] = useState<OrderMenuCategoryId>("offers");
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const savedTheme = localStorage.getItem("theme");

    if (appThemes.includes(savedTheme as AppTheme)) {
      return savedTheme as AppTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [receiptLogoPath, setReceiptLogoPath] = useState(() => getValidReceiptLogoPath(localStorage.getItem(receiptLogoPreferenceKey)));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(receiptLogoPreferenceKey, receiptLogoPath);
  }, [receiptLogoPath]);

  useEffect(() => {
    if (!isOrdersModalOpen && !isSalesModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOrdersModalOpen(false);
        setIsSalesModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOrdersModalOpen, isSalesModalOpen]);

  const salesSection = (
    <SalesSection
      loading={finance.loading}
      sales={finance.sales}
      receiptLogoPath={receiptLogoPath}
      onDelete={(id) => void finance.handleDelete("sales", id)}
      onUpdateStatus={(id, status, paymentAmounts) => void finance.updateSaleStatus(id, status, paymentAmounts)}
      onUpdateSale={(id, updates) => void finance.updateSaleDetails(id, updates)}
      onExport={finance.exportSalesCsv}
      onImport={finance.importSalesCsv}
    />
  );

  const contentBySection = {
    home: <HomeSection activeMenuCategory={activeMenuCategory} receiptLogoPath={receiptLogoPath} onRegisterSale={finance.addSaleFromOrder} />,
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
    ventas: salesSection,
    inventario: (
      <InventorySection
        loading={finance.loading}
        inventory={finance.inventory}
        onDelete={(id) => void finance.handleDelete("inventory", id)}
        onExport={finance.exportInventoryCsv}
      />
    ),
    ingredientes: <IngredientControlPage />,
    eventos: <EventsSection receiptLogoPath={receiptLogoPath} />,
    configuracion: (
      <SettingsSection
        theme={theme}
        receiptLogoPath={receiptLogoPath}
        onExport={finance.exportBackup}
        onClearAllData={() => void finance.handleClearAllData()}
        onThemeChange={setTheme}
        onReceiptLogoChange={setReceiptLogoPath}
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
              onOpenSales={() => setIsSalesModalOpen(true)}
              onOpenOrders={() => setIsOrdersModalOpen(true)}
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

      {isSalesModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-rose-950/60 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Gestion de ventas"
        >
          <div className="mx-auto flex h-full max-w-[1480px] flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_30px_90px_rgba(28,25,23,0.35)] backdrop-blur">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-100 bg-white/70 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs font-black uppercase text-fuchsia-600">Modulo interno</p>
                <h2 className="text-lg font-black text-rose-950">Ventas</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSalesModalOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-white hover:text-fuchsia-700"
                aria-label="Cerrar ventas"
              >
                <XIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">{salesSection}</div>
          </div>
        </div>
      ) : null}

      {isOrdersModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-rose-950/60 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Gestion de pedidos"
        >
          <div className="mx-auto flex h-full max-w-[1480px] flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_30px_90px_rgba(28,25,23,0.35)] backdrop-blur">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-100 bg-white/70 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs font-black uppercase text-fuchsia-600">Modulo interno</p>
                <h2 className="text-lg font-black text-rose-950">Pedidos</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrdersRefreshToken((current) => current + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-white hover:text-fuchsia-700"
                  aria-label="Actualizar pedidos"
                >
                  <RefreshIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOrdersModalOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-white hover:text-fuchsia-700"
                  aria-label="Cerrar pedidos"
                >
                  <XIcon />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
              <OrdersManagementPage refreshToken={ordersRefreshToken} receiptLogoPath={receiptLogoPath} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
