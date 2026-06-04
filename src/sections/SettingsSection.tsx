import { useEffect, useState } from "react";

import { MoonIcon, PrintIcon, SunIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { formatCurrency } from "../lib/format";
import { receiptLogoOptions } from "../lib/receipt-settings";
import { printTicket } from "../lib/thermal-printer";
import { buildTestTicketData, buildThanksTestTicketData, type ReceiptPaperSize } from "../lib/thermal-ticket";

const thanksImagePath = "ceeseburgito.jpeg";

export type AppTheme = "light" | "dark" | "red-dark" | "gray-dark";

const themeOptions: Array<{
  id: AppTheme;
  label: string;
  detail: string;
  swatchClass: string;
}> = [
  { id: "light", label: "Blanco", detail: "Fondo claro", swatchClass: "bg-white" },
  { id: "dark", label: "Negro", detail: "Fondo negro", swatchClass: "bg-stone-950" },
  { id: "red-dark", label: "Rojo oscuro", detail: "Fondo rojo profundo", swatchClass: "bg-red-950" },
  { id: "gray-dark", label: "Plomo oscuro", detail: "Fondo gris oscuro", swatchClass: "bg-stone-700" },
];

export function SettingsSection({
  theme,
  receiptLogoPath,
  initialBalances,
  onExport,
  onClearAllData,
  onThemeChange,
  onReceiptLogoChange,
  onInitialBalancesChange,
}: {
  theme: AppTheme;
  receiptLogoPath: string;
  initialBalances: {
    cash: number;
    debit: number;
    controlStartDate: string;
  };
  onExport: () => void;
  onClearAllData: () => void;
  onThemeChange: (theme: AppTheme) => void;
  onReceiptLogoChange: (logoPath: string) => void;
  onInitialBalancesChange: (balances: { cash: number; debit: number; controlStartDate: string }) => void;
}) {
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [isPrinting, setIsPrinting] = useState(false);
  const [initialBalanceForm, setInitialBalanceForm] = useState({
    cash: String(initialBalances.cash),
    debit: String(initialBalances.debit),
    controlStartDate: initialBalances.controlStartDate,
  });

  useEffect(() => {
    setInitialBalanceForm({
      cash: String(initialBalances.cash),
      debit: String(initialBalances.debit),
      controlStartDate: initialBalances.controlStartDate,
    });
  }, [initialBalances.cash, initialBalances.controlStartDate, initialBalances.debit]);

  const handleSaveInitialBalances = () => {
    onInitialBalancesChange({
      cash: Number.parseInt(initialBalanceForm.cash, 10) || 0,
      debit: Number.parseInt(initialBalanceForm.debit, 10) || 0,
      controlStartDate: initialBalanceForm.controlStartDate,
    });
  };

  const handlePrintTest = async () => {
    if (isPrinting) {
      return;
    }

    setIsPrinting(true);

    try {
      await printTicket(
        buildTestTicketData({
          paperSize,
          logoPath: receiptLogoPath,
        }),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible imprimir la boleta de prueba.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintThanksTest = async () => {
    if (isPrinting) {
      return;
    }

    setIsPrinting(true);

    try {
      await printTicket(
        buildThanksTestTicketData({
          paperSize,
          imagePath: thanksImagePath,
        }),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible imprimir la prueba de gracias.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <section className="flex min-h-full flex-col gap-4">
      <section className={`${shellCardClass} space-y-5`}>
        <div className="flex flex-col gap-3 border-b border-rose-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-600">Configuracion</p>
            <h2 className="mt-1 text-2xl font-black text-rose-950">Preferencias y datos</h2>
            <p className="mt-2 max-w-2xl text-sm text-rose-700">
              Ajusta la apariencia de la app y gestiona los respaldos guardados en este dispositivo.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
            <p className="text-sm font-bold text-rose-950">Apariencia</p>
            <p className="mt-2 text-sm text-rose-700/80">Elige el tema visual de la app.</p>
            <div className="mt-5 grid gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onThemeChange(option.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold shadow-sm transition ${
                    theme === option.id
                      ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                      : "border-rose-100 bg-white text-rose-800 hover:border-fuchsia-200 hover:text-fuchsia-700"
                  }`}
                  aria-pressed={theme === option.id}
                >
                  <span className={`h-9 w-9 rounded-full border border-white/80 shadow-sm ${option.swatchClass}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block">{option.label}</span>
                    <span className="block text-xs font-medium text-rose-500">{option.detail}</span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-current">
                    {option.id === "light" ? <SunIcon /> : <MoonIcon />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
            <p className="text-sm font-bold text-rose-950">Saldos iniciales</p>
            <p className="mt-2 text-sm text-rose-700/80">
              Ajusta el efectivo y debito base usados para calcular el dinero disponible.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Efectivo inicial</span>
                <input
                  value={initialBalanceForm.cash}
                  onChange={(event) => setInitialBalanceForm((current) => ({ ...current, cash: event.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                  placeholder="0"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Debito inicial</span>
                <input
                  value={initialBalanceForm.debit}
                  onChange={(event) => setInitialBalanceForm((current) => ({ ...current, debit: event.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                  placeholder="0"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Desde</span>
                <input
                  type="date"
                  value={initialBalanceForm.controlStartDate}
                  onChange={(event) => setInitialBalanceForm((current) => ({ ...current, controlStartDate: event.target.value }))}
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                />
              </label>
            </div>
            <div className="mt-4 rounded-xl bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700">
              Total inicial: {formatCurrency((Number.parseInt(initialBalanceForm.cash, 10) || 0) + (Number.parseInt(initialBalanceForm.debit, 10) || 0))}
            </div>
            <button
              type="button"
              onClick={handleSaveInitialBalances}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
            >
              Guardar saldos
            </button>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
            <p className="text-sm font-bold text-rose-950">Backup</p>
            <p className="mt-2 text-sm text-rose-700/80">Descarga un respaldo JSON con la informacion actual.</p>
            <button
              type="button"
              onClick={onExport}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
            >
              Exportar backup JSON
            </button>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-bold text-rose-950">Zona de limpieza</p>
            <p className="mt-2 text-sm text-red-700">Elimina todas las compras, ventas e inventario guardados.</p>
            <button
              type="button"
              onClick={onClearAllData}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 hover:text-red-800"
            >
              Borrar todos los datos de la app
            </button>
          </div>
        </div>
      </section>

      <section className={`${shellCardClass} space-y-5`}>
        <div className="flex flex-col gap-3 border-b border-rose-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-600">Configuracion</p>
            <h2 className="mt-1 text-2xl font-black text-rose-950">Pruebas de impresion</h2>
            <p className="mt-2 max-w-2xl text-sm text-rose-700">
              Elige la imagen de la boleta e imprime pruebas para revisar tamano, margenes y corte en la impresora.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
              <p className="text-sm font-bold text-rose-950">Imagen de boleta</p>
              <div className="mt-4 grid gap-2">
                {receiptLogoOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onReceiptLogoChange(option.path)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      receiptLogoPath === option.path
                        ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                        : "border-rose-100 bg-white text-rose-800 hover:border-fuchsia-200 hover:text-fuchsia-700"
                    }`}
                    aria-pressed={receiptLogoPath === option.path}
                  >
                    <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-white p-2">
                      <img src={`/${option.path}`} alt={option.label} className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className="block text-xs font-semibold text-rose-500">{option.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-rose-200 bg-white p-4">
                <img
                  src={`/${receiptLogoPath}`}
                  alt="Imagen seleccionada para boleta"
                  className={`mx-auto h-auto max-h-24 w-full object-contain ${paperSize === "56mm" ? "max-w-[56mm]" : "max-w-[24rem]"}`}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
              <p className="text-sm font-bold text-rose-950">Imagen gracias</p>
              <div className="mt-4 rounded-xl border border-dashed border-rose-200 bg-white p-4">
                <img
                  src={`/${thanksImagePath}`}
                  alt="Ceeseburguito"
                  className={`mx-auto h-auto w-full object-contain ${paperSize === "56mm" ? "max-w-[48mm]" : "max-w-[72mm]"}`}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
            <p className="text-sm font-bold text-rose-950">Boleta de test</p>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
              <div className="grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                {(["80mm", "56mm"] as ReceiptPaperSize[]).map((currentPaperSize) => (
                  <button
                    key={currentPaperSize}
                    type="button"
                    onClick={() => setPaperSize(currentPaperSize)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      paperSize === currentPaperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                    }`}
                  >
                    {currentPaperSize}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrintTest}
              disabled={isPrinting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PrintIcon />
              {isPrinting ? "Imprimiendo..." : "Imprimir prueba"}
            </button>

            <button
              type="button"
              onClick={handlePrintThanksTest}
              disabled={isPrinting}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:border-fuchsia-200 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PrintIcon />
              {isPrinting ? "Imprimiendo..." : "Imprimir prueba gracias"}
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
