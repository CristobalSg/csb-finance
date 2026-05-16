import { useState } from "react";

import { PrintIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { printTicket } from "../lib/thermal-printer";
import { buildTestTicketData, type ReceiptPaperSize } from "../lib/thermal-ticket";

const horizontalLogoPath = "Logo_ceese_horizontal_png.png";

export function SettingsSection() {
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

  return (
    <section className="flex min-h-full flex-col gap-4">
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
          <div className="rounded-2xl border border-rose-100 bg-white/70 p-4">
            <p className="text-sm font-bold text-rose-950">Logo de prueba</p>
            <div className="mt-4 rounded-xl border border-dashed border-rose-200 bg-white p-4">
              <img
                src={`/${horizontalLogoPath}`}
                alt="Ceese Burger's horizontal"
                className="mx-auto h-auto max-h-24 w-full max-w-[24rem] object-contain"
              />
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
          </div>
        </div>
      </section>
    </section>
  );
}
