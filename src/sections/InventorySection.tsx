import { useMemo, useState } from "react";

import { TableEmpty } from "../components/common/TableEmpty";
import { PrintIcon, XIcon } from "../components/icons";
import {
  movementPaymentMethodLabels,
  movementTypeLabels,
  purchaseItemTypeLabels,
  shellCardClass,
  stockControlModeLabels,
} from "../constants/app";
import { formatShortDate } from "../lib/date";
import { formatCurrency, formatNumber } from "../lib/format";
import { printTicket } from "../lib/thermal-printer";
import { buildInventoryReportTicketData, type ReceiptPaperSize, type TicketItem, type TicketTotalLine } from "../lib/thermal-ticket";
import type { InventoryItem, Purchase } from "../types";

type InventoryPrintMode = "daily-expenses" | "weekly-expenses" | "inventory";

const printModeLabels: Record<InventoryPrintMode, string> = {
  "daily-expenses": "Gastos del dia",
  "weekly-expenses": "Gastos semana",
  inventory: "Inventario actual",
};

const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createLocalDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const getWeekRange = (date: string) => {
  const selectedDate = createLocalDate(date);
  const mondayOffset = (selectedDate.getDay() + 6) % 7;
  const start = createLocalDate(date);
  start.setDate(selectedDate.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatReportDate = (date: Date) =>
  date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

const getPurchaseAmount = (purchase: Purchase) => purchase.amount ?? purchase.total;

const isExpensePurchase = (purchase: Purchase) => purchase.movementType !== "inversion" && purchase.entryType !== "investment";

const getPurchaseTypeLabel = (purchase: Purchase) =>
  purchase.movementType ? movementTypeLabels[purchase.movementType] : purchaseItemTypeLabels[purchase.itemType ?? "operating_expense"];

export function InventorySection({
  loading,
  inventory,
  purchases,
  receiptLogoPath,
  onDelete,
  onExport,
}: {
  loading: boolean;
  inventory: InventoryItem[];
  purchases: Purchase[];
  receiptLogoPath: string;
  onDelete: (id: string) => void;
  onExport: () => void;
}) {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printMode, setPrintMode] = useState<InventoryPrintMode>("daily-expenses");
  const [printDate, setPrintDate] = useState(getDateInputValue);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("56mm");

  const expenseReportRange = useMemo(() => {
    if (printMode === "weekly-expenses") {
      return getWeekRange(printDate);
    }

    const start = createLocalDate(printDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end };
  }, [printDate, printMode]);

  const expenseReportPurchases = useMemo(() => {
    const startDate = formatLocalDate(expenseReportRange.start);
    const endDate = formatLocalDate(expenseReportRange.end);

    return purchases
      .filter((purchase) => isExpensePurchase(purchase) && purchase.date >= startDate && purchase.date < endDate)
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }, [expenseReportRange.end, expenseReportRange.start, purchases]);

  const expenseTotals = useMemo(
    () => ({
      cash: expenseReportPurchases
        .filter((purchase) => purchase.paymentMethod === "efectivo")
        .reduce((total, purchase) => total + getPurchaseAmount(purchase), 0),
      debit: expenseReportPurchases
        .filter((purchase) => purchase.paymentMethod !== "efectivo")
        .reduce((total, purchase) => total + getPurchaseAmount(purchase), 0),
      total: expenseReportPurchases.reduce((total, purchase) => total + getPurchaseAmount(purchase), 0),
    }),
    [expenseReportPurchases],
  );

  const inventoryTotal = useMemo(() => inventory.reduce((total, item) => total + item.total, 0), [inventory]);
  const inventoryUnits = useMemo(() => inventory.reduce((total, item) => total + item.quantity, 0), [inventory]);

  const closePrintModal = () => {
    setIsPrintModalOpen(false);
    setPrintMode("daily-expenses");
    setPrintDate(getDateInputValue());
    setPaperSize("56mm");
  };

  const buildExpenseReport = () => {
    const isWeekly = printMode === "weekly-expenses";
    const weekEndDisplay = new Date(expenseReportRange.end);
    weekEndDisplay.setDate(weekEndDisplay.getDate() - 1);
    const items: TicketItem[] = expenseReportPurchases.map((purchase) => ({
      name: purchase.detail,
      qty: purchase.quantity || 1,
      price: getPurchaseAmount(purchase),
      notes: [
        getPurchaseTypeLabel(purchase),
        purchase.paymentMethod ? movementPaymentMethodLabels[purchase.paymentMethod] : "",
        purchase.unit ? `Unidad: ${purchase.unit}` : "",
      ].filter(Boolean),
    }));
    const summary: TicketTotalLine[] = [
      { label: "Registros", value: expenseReportPurchases.length },
      { label: "Efectivo", value: expenseTotals.cash },
      { label: "Debito / otros", value: expenseTotals.debit },
    ];

    return buildInventoryReportTicketData({
      paperSize,
      logoPath: receiptLogoPath,
      title: isWeekly ? "Gastos semana" : "Gastos del dia",
      dateRange: isWeekly
        ? `${formatReportDate(expenseReportRange.start)} a ${formatReportDate(weekEndDisplay)}`
        : formatReportDate(expenseReportRange.start),
      summary,
      totalLabel: "Total gastos",
      total: expenseTotals.total,
      items,
    });
  };

  const buildInventoryReport = () =>
    buildInventoryReportTicketData({
      paperSize,
      logoPath: receiptLogoPath,
      title: "Inventario actual",
      dateRange: new Date().toLocaleString("es-CL"),
      summary: [
        { label: "Productos", value: inventory.length },
        { label: "Unidades", value: inventoryUnits },
      ],
      totalLabel: "Valor inventario",
      total: inventoryTotal,
      items: inventory.map((item) => ({
        name: item.name,
        qty: item.quantity,
        price: item.total,
        notes: [
          item.itemType ? purchaseItemTypeLabels[item.itemType] : "Stock manual",
          item.place ? `Lugar: ${item.place}` : "",
          `Unitario: ${formatCurrency(item.unitPrice)}`,
        ].filter(Boolean),
      })),
    });

  const handlePrint = async () => {
    try {
      await printTicket(printMode === "inventory" ? buildInventoryReport() : buildExpenseReport());
      closePrintModal();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible imprimir el reporte.");
    }
  };

  return (
    <section id="inventario" className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsPrintModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-5 py-3 text-sm font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-white"
        >
          <PrintIcon />
          Imprimir
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Exportar inventario CSV
        </button>
      </div>

      {isPrintModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Inventario</p>
                <h3 className="mt-1 text-xl font-bold text-rose-950">Imprimir reporte</h3>
              </div>
              <button
                type="button"
                onClick={closePrintModal}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar impresion de inventario"
              >
                <XIcon />
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Reporte</p>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-full bg-rose-50 p-1">
                {(["daily-expenses", "weekly-expenses", "inventory"] as InventoryPrintMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPrintMode(mode)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      printMode === mode ? "bg-fuchsia-600 text-white" : "text-rose-700"
                    }`}
                  >
                    {printModeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                  {printMode === "daily-expenses" ? "Dia" : "Fecha de referencia"}
                </span>
                <input
                  type="date"
                  value={printDate}
                  onChange={(event) => {
                    if (event.target.value) {
                      setPrintDate(event.target.value);
                    }
                  }}
                  disabled={printMode === "inventory"}
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                  {(["56mm", "80mm"] as ReceiptPaperSize[]).map((nextPaperSize) => (
                    <button
                      key={nextPaperSize}
                      type="button"
                      onClick={() => setPaperSize(nextPaperSize)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                        paperSize === nextPaperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                      }`}
                    >
                      {nextPaperSize}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.25rem] bg-rose-50/60 p-4 text-sm text-rose-800">
              {printMode === "inventory" ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span>Productos</span>
                    <span className="font-black">{formatNumber(inventory.length)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span>Valor inventario</span>
                    <span className="font-black">{formatCurrency(inventoryTotal)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <span>Registros</span>
                    <span className="font-black">{formatNumber(expenseReportPurchases.length)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span>Total gastos</span>
                    <span className="font-black">{formatCurrency(expenseTotals.total)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePrintModal}
                className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
              >
                <PrintIcon />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-rose-950">Inventario actual</h3>
              <p className="text-sm text-rose-700/80">Las existencias se alimentan desde compras con impacto en stock.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {formatNumber(inventory.length)} productos
            </span>
          </div>

          {loading ? (
            <TableEmpty message="Cargando inventario..." />
          ) : inventory.length === 0 ? (
            <TableEmpty message="Todavia no hay productos en inventario." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-rose-500">
                  <tr>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Nombre</th>
                    <th className="pb-3 pr-4 font-semibold">Tipo</th>
                    <th className="pb-3 pr-4 font-semibold">Cantidad</th>
                    <th className="pb-3 pr-4 font-semibold">Lugar</th>
                    <th className="pb-3 pr-4 font-semibold">Precio unitario</th>
                    <th className="pb-3 pr-4 font-semibold">Total</th>
                    <th className="pb-3 font-semibold">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className="border-t border-rose-100 align-top text-rose-900">
                      <td className="py-4 pr-4">{formatShortDate(item.date)}</td>
                      <td className="py-4 pr-4 font-semibold">{item.name}</td>
                      <td className="py-4 pr-4">
                        {item.itemType ? purchaseItemTypeLabels[item.itemType] : "Stock manual"}
                        {item.stockControl && item.stockControl !== "simple" ? (
                          <span className="mt-1 block text-xs text-rose-500">{stockControlModeLabels[item.stockControl]}</span>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4">{formatNumber(item.quantity)}</td>
                      <td className="py-4 pr-4">{item.place || "Sin referencia"}</td>
                      <td className="py-4 pr-4">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 pr-4 font-bold text-rose-700">{formatCurrency(item.total)}</td>
                      <td className="py-4">
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 transition hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
