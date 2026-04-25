import { Fragment, type ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PaginationControls } from "../components/common/PaginationControls";
import { TableEmpty } from "../components/common/TableEmpty";
import { PrintIcon } from "../components/icons";
import { saleStatusLabels, shellCardClass } from "../constants/app";
import { familyComboDescriptions } from "../data/order-menu";
import { formatShortDate } from "../lib/date";
import { formatCurrency, formatNumber } from "../lib/format";
import { setupReceiptPrintPage } from "../lib/receipt-print";
import type { Sale, SaleOrderItem, SaleStatus } from "../types";

const HISTORY_PAGE_SIZE = 8;

const formatSaleOrderItems = (sale: Sale) => {
  if (sale.orderItems && sale.orderItems.length > 0) {
    return sale.orderItems;
  }

  return [
    {
      name: sale.productName || sale.detail || "Pedido",
      quantity: sale.quantity || 1,
      unitPrice: sale.total,
      total: sale.total,
    },
  ] satisfies SaleOrderItem[];
};

const truncateText = (text: string, maxLength = 42) => {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const getKitchenGroups = (items: SaleOrderItem[]) => {
  const groups = new Map<
    string,
    {
      name: string;
      quantity: number;
      drinks: string[];
      sauces: string[];
      removedIngredients: string[];
    }
  >();

  for (const item of items) {
    const removedIngredients = [...(item.removedIngredients ?? [])].sort((a, b) => a.localeCompare(b));
    const key = [item.name, item.drink ?? "", item.sauce ?? "", removedIngredients.join("|")].join("::");
    const existing = groups.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    groups.set(key, {
      name: item.name,
      quantity: item.quantity,
      drinks: item.drink ? [item.drink] : [],
      sauces: item.sauce ? [item.sauce] : [],
      removedIngredients,
    });
  }

  return Array.from(groups.values());
};

const getKitchenSummary = (items: SaleOrderItem[]) => {
  const drinks = new Map<string, number>();
  const sauces = new Map<string, number>();
  let fries = 0;

  for (const item of items) {
    if (item.name.toLowerCase().includes("papa") || item.name.toLowerCase().includes("papita")) {
      fries += item.quantity;
    }

    if (item.drink) {
      drinks.set(item.drink, (drinks.get(item.drink) ?? 0) + item.quantity);
    }

    if (item.sauce) {
      sauces.set(item.sauce, (sauces.get(item.sauce) ?? 0) + item.quantity);
    }
  }

  return {
    drinks: Array.from(drinks.entries()),
    sauces: Array.from(sauces.entries()),
    fries,
  };
};

export function SalesSection({
  loading,
  sales,
  onDelete,
  onUpdateStatus,
  onExport,
  onImport,
}: {
  loading: boolean;
  sales: Sale[];
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: SaleStatus) => void;
  onExport: () => void;
  onImport: (csvContent: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  const totalHistoryPages = Math.max(1, Math.ceil(sales.length / HISTORY_PAGE_SIZE));
  const paginatedSales = useMemo(
    () => sales.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE),
    [historyPage, sales],
  );

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, totalHistoryPages));
  }, [totalHistoryPages]);

  const onImportClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) onImport(content);
    };
    reader.readAsText(file);
  };

  const handleReprintReceipt = (sale: Sale) => {
    setReceiptSale(sale);

    window.setTimeout(() => {
      const cleanup = () => {
        document.body.classList.remove("printing-receipt");
        window.removeEventListener("afterprint", cleanup);
        removeReceiptPageStyle();
        setReceiptSale(null);
      };

      const removeReceiptPageStyle = setupReceiptPrintPage();
      document.body.classList.add("printing-receipt");
      window.addEventListener("afterprint", cleanup, { once: true });
      window.print();
      window.setTimeout(cleanup, 500);
    }, 0);
  };

  const receiptItems = receiptSale ? formatSaleOrderItems(receiptSale) : [];
  const kitchenGroups = getKitchenGroups(receiptItems);
  const kitchenSummary = getKitchenSummary(receiptItems);

  return (
    <section id="ventas" className="flex h-full min-h-0 flex-col space-y-4">
      {receiptSale ? (
        <div data-receipt-print className="pointer-events-none fixed left-[-9999px] top-0">
          <div className="receipt-paper">
            <div className="text-center">
              <p className="text-xs font-black uppercase">Comanda</p>
              <p className="mt-1 text-[11px] font-bold">{new Date(receiptSale.createdAt).toLocaleString("es-CL")}</p>
              <p className="mt-3 text-3xl font-black leading-none">{receiptSale.fulfillmentTime?.trim() || "Ahora"}</p>
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="receipt-cut space-y-1 text-xs font-semibold">
              {receiptSale.client.trim() ? <p>Pedido: {receiptSale.client.trim()}</p> : null}
              <p>Entrega: {receiptSale.deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
              {receiptSale.deliveryType === "delivery" && receiptSale.deliveryAddress?.trim() ? (
                <p>Direccion: {receiptSale.deliveryAddress.trim()}</p>
              ) : null}
              {receiptSale.detail.trim() ? <p>Nota: {receiptSale.detail.trim()}</p> : null}
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="space-y-3">
              {kitchenGroups.map((group, index) => (
                <div key={`${group.name}-${index}`} className="receipt-cut">
                  <p className="text-sm font-black">
                    {group.quantity} x {group.name}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs font-semibold">
                    {familyComboDescriptions[group.name] ? <p>Incluye: {familyComboDescriptions[group.name]}</p> : null}
                    {group.removedIngredients.length > 0 ? <p>Sin: {group.removedIngredients.join(", ")}</p> : null}
                    {group.drinks.length > 0 ? <p>Bebida: {group.drinks.join(", ")}</p> : null}
                    {group.sauces.length > 0 ? <p>Salsa: {group.sauces.join(", ")}</p> : null}
                  </div>
                </div>
              ))}
            </div>

            {kitchenSummary.drinks.length > 0 || kitchenSummary.sauces.length > 0 || kitchenSummary.fries > 0 ? (
              <>
                <div className="my-3 border-t border-dashed border-black" />
                <div className="receipt-cut space-y-2 text-xs font-bold">
                  {kitchenSummary.fries > 0 ? <p>Papas: {kitchenSummary.fries}</p> : null}
                  {kitchenSummary.drinks.length > 0 ? (
                    <div>
                      <p className="font-black uppercase">Bebidas</p>
                      {kitchenSummary.drinks.map(([drink, quantity]) => (
                        <p key={drink}>
                          {quantity} x {drink}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {kitchenSummary.sauces.length > 0 ? (
                    <div>
                      <p className="font-black uppercase">Salsas</p>
                      {kitchenSummary.sauces.map(([sauce, quantity]) => (
                        <p key={sauce}>
                          {quantity} x {sauce}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="receipt-paper">
            <div className="text-center">
              <img src="/receipt-logo.png" alt="Ceese Burger's" className="receipt-logo" />
              <p className="mt-1 text-xs font-bold">{new Date(receiptSale.createdAt).toLocaleString("es-CL")}</p>
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="receipt-cut space-y-1 text-xs font-semibold">
              {receiptSale.client.trim() ? <p>Nombre: {receiptSale.client.trim()}</p> : null}
              {receiptSale.fulfillmentTime?.trim() ? <p>Hora entrega: {receiptSale.fulfillmentTime.trim()}</p> : null}
              <p>Pago: {saleStatusLabels[receiptSale.status]}</p>
              <p>Entrega: {receiptSale.deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
              {receiptSale.deliveryType === "delivery" && receiptSale.deliveryAddress?.trim() ? (
                <p>Direccion: {receiptSale.deliveryAddress.trim()}</p>
              ) : null}
              {receiptSale.deliveryType === "delivery" ? <p>Valor delivery: {formatCurrency(receiptSale.deliveryFee ?? 0)}</p> : null}
              {receiptSale.detail.trim() ? <p>Detalle: {receiptSale.detail.trim()}</p> : null}
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="space-y-3">
              {receiptItems.map((item, index) => {
                const notes = [
                  item.drink ? `Bebida: ${item.drink}` : "",
                  item.sauce ? `Salsa: ${item.sauce}` : "",
                  item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
                ].filter(Boolean);

                return (
                  <div key={`${receiptSale.id}-receipt-${item.name}-${index}`} className="receipt-cut">
                    <div className="flex justify-between gap-2 text-xs font-bold">
                      <span className="min-w-0 break-words">
                        {item.quantity} x {item.name}
                      </span>
                      <span className="shrink-0 whitespace-nowrap">{formatCurrency(item.total)}</span>
                    </div>
                    {notes.length > 0 ? (
                      <div className="mt-1 space-y-0.5 text-[11px] font-semibold leading-4">
                        {notes.map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            {receiptSale.deliveryType === "delivery" ? (
              <div className="space-y-1 text-xs font-bold">
                <div className="flex justify-between gap-2">
                  <span>Subtotal</span>
                  <span className="shrink-0 whitespace-nowrap">{formatCurrency(receiptSale.total - (receiptSale.deliveryFee ?? 0))}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Delivery</span>
                  <span className="shrink-0 whitespace-nowrap">{formatCurrency(receiptSale.deliveryFee ?? 0)}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-2 flex justify-between text-sm font-black">
              <span>Total</span>
              <span className="shrink-0 whitespace-nowrap">{formatCurrency(receiptSale.total)}</span>
            </div>
          </div>

          <div className="receipt-paper">
            <div className="flex min-h-[48mm] flex-col items-center justify-center text-center">
              <p className="text-xl font-black uppercase leading-tight">Muchas gracias</p>
              <p className="mt-2 text-sm font-bold">Que las disfrute</p>
              <p className="mt-3 text-base font-black uppercase">Ceese Burger's</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Exportar ventas CSV
        </button>
        <button
          type="button"
          onClick={onImportClick}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Importar ventas CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      <div className="min-h-0 flex-1">
        <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-rose-950">Historial de ventas</h3>
              <p className="text-sm text-rose-700/80">Diferencia rapidamente entre ventas cobradas y pendientes.</p>
            </div>
            <span className="rounded-full bg-fuchsia-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-600">
              {formatNumber(sales.length)} registros
            </span>
          </div>

          {loading ? (
            <TableEmpty message="Cargando ventas..." />
          ) : sales.length === 0 ? (
            <TableEmpty message="Todavia no hay ventas registradas." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-rose-500">
                  <tr>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Cliente</th>
                    <th className="pb-3 pr-4 font-semibold">Pedido</th>
                    <th className="pb-3 pr-4 font-semibold">Detalle</th>
                    <th className="pb-3 pr-4 font-semibold">Entrega</th>
                    <th className="pb-3 pr-4 font-semibold">Total</th>
                    <th className="pb-3 pr-4 font-semibold">Estado</th>
                    <th className="pb-3 font-semibold">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => {
                    const orderItems = formatSaleOrderItems(sale);
                    const isExpanded = expandedSaleId === sale.id;

                    return (
                      <Fragment key={sale.id}>
                        <tr
                          className="cursor-pointer border-t border-rose-100 align-top text-rose-900 transition-colors duration-300 hover:bg-rose-50/15"
                          onClick={() => setExpandedSaleId((current) => (current === sale.id ? null : sale.id))}
                        >
                          <td className="py-4 pr-4">{formatShortDate(sale.date)}</td>
                          <td className="py-4 pr-4">{sale.client || "Sin cliente"}</td>
                          <td className="py-4 pr-4">
                            <p className="font-semibold text-rose-950">
                              {formatNumber(orderItems.reduce((total, item) => total + item.quantity, 0))} productos
                            </p>
                            <p className="mt-1 text-xs text-rose-500">{isExpanded ? "Ocultar pedido" : "Ver pedido"}</p>
                          </td>
                          <td className="max-w-48 py-4 pr-4" title={sale.detail || "Sin nota"}>
                            {sale.detail ? truncateText(sale.detail) : "Sin nota"}
                          </td>
                          <td className="py-4 pr-4">
                            <p className="font-semibold">{sale.deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
                            {sale.fulfillmentTime ? <p className="mt-1 text-xs font-bold text-rose-950">Hora: {sale.fulfillmentTime}</p> : null}
                            {sale.deliveryType === "delivery" && sale.deliveryAddress ? (
                              <p className="mt-1 text-xs text-rose-700/80">{sale.deliveryAddress}</p>
                            ) : null}
                            {sale.deliveryType === "delivery" ? (
                              <p className="mt-1 text-xs font-semibold text-fuchsia-700">{formatCurrency(sale.deliveryFee ?? 0)}</p>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4 font-bold text-fuchsia-700">{formatCurrency(sale.total)}</td>
                          <td className="py-4 pr-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                                sale.status === "pendiente"
                                  ? "bg-amber-50 text-amber-700"
                                  : sale.status === "efectivo"
                                    ? "bg-rose-50 text-rose-600"
                                    : "bg-fuchsia-50 text-fuchsia-700"
                              }`}
                            >
                              {saleStatusLabels[sale.status]}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                              {sale.status === "pendiente" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateStatus(sale.id, "efectivo")}
                                    className="rounded-full border border-rose-500 bg-rose-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:border-rose-800 hover:bg-rose-800 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-300"
                                  >
                                    Efectivo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateStatus(sale.id, "transferencia")}
                                    className="rounded-full border border-fuchsia-600 bg-fuchsia-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:border-fuchsia-900 hover:bg-fuchsia-900 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                                  >
                                    Debito / transferencia
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleReprintReceipt(sale)}
                                className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 shadow-sm transition hover:border-stone-800 hover:bg-stone-800 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                              >
                                <PrintIcon />
                                Reimprimir
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(sale.id)}
                                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 transition hover:border-rose-700 hover:bg-rose-700 hover:text-white"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr className="border-t border-rose-100 bg-rose-50/50 text-rose-900">
                            <td className="px-4 py-4" colSpan={8}>
                              <div className="grid gap-3 md:grid-cols-2">
                                {sale.detail ? (
                                  <div className="rounded-[1.25rem] border border-rose-100 bg-white/80 p-4 md:col-span-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Detalle / nota</p>
                                    <p className="mt-2 text-sm leading-6 text-rose-800">{sale.detail}</p>
                                  </div>
                                ) : null}
                                {orderItems.map((item, index) => (
                                  <div key={`${sale.id}-${item.name}-${index}`} className="rounded-[1.25rem] border border-rose-100 bg-white/80 p-4">
                                    <div className="flex justify-between gap-3">
                                      <p className="font-bold text-rose-950">
                                        {formatNumber(item.quantity)} x {item.name}
                                      </p>
                                      <p className="font-bold text-fuchsia-700">{formatCurrency(item.total)}</p>
                                    </div>
                                    <p className="mt-1 text-xs text-rose-500">{formatCurrency(item.unitPrice)} c/u</p>
                                    {item.drink || item.sauce || item.removedIngredients?.length ? (
                                      <p className="mt-2 text-xs leading-5 text-rose-700/80">
                                        {[
                                          item.drink ? `Bebida: ${item.drink}` : "",
                                          item.sauce ? `Salsa: ${item.sauce}` : "",
                                          item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              <PaginationControls
                page={historyPage}
                pageSize={HISTORY_PAGE_SIZE}
                totalItems={sales.length}
                totalPages={totalHistoryPages}
                onPageChange={setHistoryPage}
              />
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
