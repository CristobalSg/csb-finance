import { useState } from "react";

import { MoonIcon, PrintIcon, SunIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { printTicket } from "../lib/thermal-printer";
import { buildTestTicketData, buildThanksTestTicketData, type ReceiptPaperSize } from "../lib/thermal-ticket";

const horizontalLogoPath = "Logo_ceese_horizontal_png.png";
const thanksImagePath = "ceeseburgito.jpeg";

export function SettingsSection({
  isDarkMode,
  onExport,
  onClearAllData,
  onToggleDarkMode,
}: {
  isDarkMode: boolean;
  onExport: () => void;
  onClearAllData: () => void;
  onToggleDarkMode: () => void;
}) {
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintTest = async () => {
    if (isPrinting) {
      return;
    }

    setIsPrinting(true);

    try {
      await printTicket(
        buildTestTicketData({
          paperSize,
          logoPath: horizontalLogoPath,
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

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
            <p className="text-sm font-bold text-rose-950">Apariencia</p>
            <p className="mt-2 text-sm text-rose-700/80">Cambia entre modo claro y modo oscuro.</p>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:border-fuchsia-200 hover:text-fuchsia-700"
            >
              {isDarkMode ? <SunIcon /> : <MoonIcon />}
              {isDarkMode ? "Activar modo claro" : "Activar modo oscuro"}
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
              Imprime una boleta de test con el logo horizontal para revisar tamano, margenes y corte en la impresora.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
              <p className="text-sm font-bold text-rose-950">Logo de prueba</p>
              <div className="mt-4 rounded-xl border border-dashed border-rose-200 bg-white p-4">
                <img
                  src={`/${horizontalLogoPath}`}
                  alt="Ceese Burger's horizontal"
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
