import { useCallback, useEffect, useMemo, useState } from "react";

import { PaginationControls } from "../components/common/PaginationControls";
import { PrintIcon, XIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { formatCurrency, formatNumber } from "../lib/format";
import { fetchOrders, updateOrderStatus } from "../lib/orders";
import { printTicket } from "../lib/thermal-printer";
import { buildTicketData, type ReceiptPaperSize, type TicketSectionSelection } from "../lib/thermal-ticket";
import type { DeliveryPaymentMethod, DeliveryType, SaleOrderFamilyBurger, SaleOrderItem, SupabaseOrder, SupabaseOrderItem, SupabaseOrderStatus } from "../types";

const statusOptions: SupabaseOrderStatus[] = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];
const pageSize = 5;
const defaultPrintSections: TicketSectionSelection = { kitchen: true, receipt: false, thanks: false };
const printSectionOptions = [
  { key: "kitchen", label: "Comanda" },
  { key: "receipt", label: "Boleta" },
  { key: "thanks", label: "Gracias" },
] as const;

const statusLabels: Record<SupabaseOrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const statusClasses: Record<SupabaseOrderStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivered: "border-teal-200 bg-teal-50 text-teal-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

const orderTypeLabels: Record<SupabaseOrder["order_type"], string> = {
  pickup: "Retiro",
  delivery: "Delivery",
};

const paymentMethodLabels: Record<SupabaseOrder["payment_method"], string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
};

const cashPaymentTypeLabels: Record<NonNullable<SupabaseOrder["cash_payment_type"]>, string> = {
  exact: "Exacto",
  amount: "Monto indicado",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const formatJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter(Boolean);
};

const flattenSelectionLabels = (value: unknown): string[] => {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenSelectionLabels);
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    if (Array.isArray(entry)) {
      return entry.map((item) => `${key}: ${String(item)}`);
    }

    if (entry && typeof entry === "object") {
      return Object.entries(entry as Record<string, unknown>).map(([nestedKey, nestedValue]) => `${key}: ${nestedKey} ${String(nestedValue)}`);
    }

    return entry ? [`${key}: ${String(entry)}`] : [];
  });
};

const getUnitRemovals = (value: unknown): SaleOrderFamilyBurger[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((removals, index) => ({
      label: `Unidad ${index + 1}`,
      name: `Unidad ${index + 1}`,
      removedIngredients: asStringArray(removals),
    }))
    .filter((burger) => burger.removedIngredients.length > 0);
};

const getItemNotes = (item: SupabaseOrderItem) => {
  const rawNotes = item.notes;

  if (Array.isArray(rawNotes)) {
    return asStringArray(rawNotes).join(", ");
  }

  return typeof rawNotes === "string" ? rawNotes : "";
};

const mapOrderItemsToSaleItems = (items: SupabaseOrderItem[]): SaleOrderItem[] =>
  items.map((item) => {
    const selections = flattenSelectionLabels(item.selections);
    const unitSelections = flattenSelectionLabels(item.unitSelections);
    const notes = [getItemNotes(item), ...selections, ...unitSelections].filter(Boolean).join(" · ");

    return {
      name: item.title ?? item.productId ?? "Producto sin nombre",
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      total: Number(item.lineTotal ?? 0),
      removedIngredients: asStringArray(item.removals),
      familyBurgers: getUnitRemovals(item.unitRemovals),
      notes,
    };
  });

const getOrderPaymentLabel = (order: SupabaseOrder) => {
  if (order.payment_method === "transfer") {
    return "Transferencia";
  }

  if (order.cash_payment_type === "amount" && order.cash_amount) {
    return `Efectivo ${formatCurrency(order.cash_amount)}`;
  }

  return "Efectivo";
};

const getDeliveryPaymentMethod = (order: SupabaseOrder): DeliveryPaymentMethod | undefined =>
  order.order_type === "delivery" && order.payment_method === "cash" ? "efectivo" : undefined;

function StatusPill({ status }: { status: SupabaseOrderStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-xl border border-rose-100 bg-white/70 px-3 py-2">
      <p className="text-[0.68rem] font-black uppercase text-rose-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-rose-950">{value || "-"}</p>
    </div>
  );
}

function ItemDetail({ item, index }: { item: SupabaseOrderItem; index: number }) {
  const extras = [
    item.selections ? ["Selecciones", item.selections] : null,
    item.unitSelections ? ["Selecciones por unidad", item.unitSelections] : null,
    item.removals ? ["Removidos", item.removals] : null,
    item.unitRemovals ? ["Removidos por unidad", item.unitRemovals] : null,
  ].filter(Boolean) as [string, unknown][];

  return (
    <article className="rounded-2xl border border-rose-100 bg-white/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-rose-400">Item {index + 1}</p>
          <h4 className="mt-1 text-base font-black text-rose-950">{item.title ?? "Producto sin nombre"}</h4>
          <p className="mt-1 text-sm text-rose-600">{item.category ?? item.productId ?? "-"}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-black text-rose-950">
            {formatNumber(Number(item.quantity ?? 0))} x {formatCurrency(Number(item.unitPrice ?? 0))}
          </p>
          <p className="text-sm font-semibold text-fuchsia-700">{formatCurrency(Number(item.lineTotal ?? 0))}</p>
        </div>
      </div>

      {item.notes ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{item.notes}</p> : null}

      {extras.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {extras.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-rose-50/70 p-3">
              <p className="text-[0.68rem] font-black uppercase text-rose-400">{label}</p>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-rose-800">{formatJson(value)}</pre>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PrintOrderModal({
  order,
  paperSize,
  sections,
  isPrinting,
  onClose,
  onPaperSizeChange,
  onSectionsChange,
  onConfirm,
}: {
  order: SupabaseOrder;
  paperSize: ReceiptPaperSize;
  sections: TicketSectionSelection;
  isPrinting: boolean;
  onClose: () => void;
  onPaperSizeChange: (paperSize: ReceiptPaperSize) => void;
  onSectionsChange: (sections: TicketSectionSelection) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-rose-500">Pedidos</p>
            <h3 className="mt-1 text-xl font-bold text-rose-950">Imprimir boleta</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
            aria-label="Cerrar impresion"
          >
            <XIcon />
          </button>
        </div>

        <div className="mt-5 rounded-[1.25rem] bg-rose-50/60 p-4">
          <p className="text-sm font-bold text-rose-950">{order.customer_name || "Sin cliente"}</p>
          <p className="mt-1 text-xs font-semibold text-rose-600">
            {orderTypeLabels[order.order_type]} · {formatCurrency(order.total)} · {formatDateTime(order.created_at)}
          </p>
          {order.address ? <p className="mt-2 text-xs font-semibold text-rose-700">{order.address}</p> : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {printSectionOptions.map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-800"
            >
              <input
                type="checkbox"
                checked={sections[option.key]}
                onChange={(event) => onSectionsChange({ ...sections, [option.key]: event.target.checked })}
                className="h-4 w-4 accent-fuchsia-600"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
          <div className="grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
            {(["80mm", "56mm"] as ReceiptPaperSize[]).map((nextPaperSize) => (
              <button
                key={nextPaperSize}
                type="button"
                onClick={() => onPaperSizeChange(nextPaperSize)}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                  paperSize === nextPaperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                }`}
              >
                {nextPaperSize}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            disabled={isPrinting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPrinting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PrintIcon />
            {isPrinting ? "Imprimiendo" : "Confirmar impresion"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrdersManagementPage({ refreshToken = 0, receiptLogoPath }: { refreshToken?: number; receiptLogoPath: string }) {
  const [orders, setOrders] = useState<SupabaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [printOrder, setPrintOrder] = useState<SupabaseOrder | null>(null);
  const [printSections, setPrintSections] = useState<TicketSectionSelection>(defaultPrintSections);
  const [printPaperSize, setPrintPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [isPrinting, setIsPrinting] = useState(false);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null,
    [orders, selectedOrderId],
  );

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const visibleOrders = useMemo(() => orders.slice((page - 1) * pageSize, page * pageSize), [orders, page]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextOrders = await fetchOrders();
      setOrders(nextOrders);
      setSelectedOrderId((current) => current ?? nextOrders[0]?.id ?? null);
      setPage(1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders, refreshToken]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleStatusChange = async (orderId: string, status: SupabaseOrderStatus) => {
    setUpdatingId(orderId);
    setError(null);

    try {
      const updatedOrder = await updateOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No fue posible actualizar el estado.");
    } finally {
      setUpdatingId(null);
    }
  };

  const openPrintModal = (order: SupabaseOrder) => {
    setPrintOrder(order);
    setPrintSections(defaultPrintSections);
    setPrintPaperSize("80mm");
  };

  const closePrintModal = () => {
    if (isPrinting) {
      return;
    }

    setPrintOrder(null);
    setPrintSections(defaultPrintSections);
    setPrintPaperSize("80mm");
  };

  const handleConfirmPrint = async () => {
    if (!printOrder || isPrinting) {
      return;
    }

    if (!printSections.kitchen && !printSections.receipt && !printSections.thanks) {
      window.alert("Selecciona al menos una hoja para imprimir.");
      return;
    }

    setIsPrinting(true);
    setError(null);

    try {
      const deliveryType: DeliveryType = printOrder.order_type === "delivery" ? "delivery" : "retiro";
      const items = mapOrderItemsToSaleItems(printOrder.items);
      const productTotal = items.reduce((total, item) => total + item.total, 0);

      await printTicket(
        buildTicketData({
          paperSize: printPaperSize,
          logoPath: receiptLogoPath,
          sections: printSections,
          createdAt: printOrder.created_at,
          client: printOrder.customer_name,
          detail: printOrder.whatsapp_message,
          paymentLabel: getOrderPaymentLabel(printOrder),
          deliveryType,
          deliveryAddress: printOrder.address ?? "",
          deliveryFee: printOrder.delivery_fee,
          deliveryPaymentMethod: getDeliveryPaymentMethod(printOrder),
          items,
          productTotal,
          total: printOrder.total,
        }),
      );

      const updatedOrder = await updateOrderStatus(printOrder.id, "confirmed");
      setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
      setSelectedOrderId(updatedOrder.id);
      setPrintOrder(null);
      setPrintSections(defaultPrintSections);
      setPrintPaperSize("80mm");
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "No fue posible imprimir y confirmar el pedido.");
      window.alert(printError instanceof Error ? printError.message : "No fue posible imprimir y confirmar el pedido.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <section className="flex min-h-full flex-col gap-5">
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div className={`${shellCardClass} min-h-0 overflow-hidden border-rose-100 bg-white/85`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-rose-950">Listado</h2>
              <p className="text-sm text-rose-600">{loading ? "Cargando pedidos" : `${orders.length} pedidos`}</p>
            </div>
          </div>

          <div className="min-h-0 overflow-auto rounded-2xl border border-rose-100">
            <table className="min-w-[920px] w-full border-collapse bg-white/70 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-rose-50 text-xs font-black uppercase text-rose-500">
                <tr>
                  <th className="px-4 py-3">Creado</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {visibleOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`cursor-pointer transition hover:bg-fuchsia-50/60 ${
                      selectedOrder?.id === order.id ? "bg-fuchsia-50/70" : "bg-white/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-rose-950">{formatDateTime(order.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-black text-rose-950">{order.customer_name}</p>
                      <p className="max-w-40 truncate text-xs text-rose-500">{order.id}</p>
                    </td>
                    <td className="px-4 py-3 text-rose-700">
                      <p className="font-semibold">{orderTypeLabels[order.order_type]}</p>
                      <p className="max-w-48 truncate text-xs">{order.address || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-rose-700">{paymentMethodLabels[order.payment_method]}</td>
                    <td className="px-4 py-3 font-black text-rose-950">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3 text-rose-700">{formatNumber(order.total_items)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPrintModal(order);
                          }}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-fuchsia-600 transition hover:border-fuchsia-200 hover:bg-fuchsia-50"
                          aria-label="Imprimir boleta"
                        >
                          <PrintIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && orders.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm font-semibold text-rose-500">No hay pedidos registrados.</div>
            ) : null}
          </div>

          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={orders.length}
            totalPages={totalPages}
            onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
          />
        </div>

        <aside className={`${shellCardClass} min-h-0 overflow-auto border-rose-100 bg-white/85`}>
          {selectedOrder ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-rose-400">Pedido</p>
                  <h2 className="mt-1 break-all text-xl font-black text-rose-950">{selectedOrder.id}</h2>
                  <p className="mt-1 text-sm text-rose-600">{formatDateTime(selectedOrder.created_at)}</p>
                </div>
                <StatusPill status={selectedOrder.status} />
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase text-rose-400">Cambiar estado</span>
                <select
                  value={selectedOrder.status}
                  onChange={(event) => void handleStatusChange(selectedOrder.id, event.target.value as SupabaseOrderStatus)}
                  disabled={updatingId === selectedOrder.id}
                  className="mt-2 w-full rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm font-bold text-rose-950 outline-none transition focus:border-fuchsia-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Cliente" value={selectedOrder.customer_name} />
                <DetailField label="Tipo" value={orderTypeLabels[selectedOrder.order_type]} />
                <DetailField label="Direccion" value={selectedOrder.address} />
                <DetailField label="Pago" value={paymentMethodLabels[selectedOrder.payment_method]} />
                <DetailField
                  label="Tipo efectivo"
                  value={selectedOrder.cash_payment_type ? cashPaymentTypeLabels[selectedOrder.cash_payment_type] : null}
                />
                <DetailField label="Monto efectivo" value={selectedOrder.cash_amount ? formatCurrency(selectedOrder.cash_amount) : null} />
                <DetailField label="Subtotal" value={formatCurrency(selectedOrder.subtotal)} />
                <DetailField label="Delivery" value={formatCurrency(selectedOrder.delivery_fee)} />
                <DetailField label="Total" value={formatCurrency(selectedOrder.total)} />
                <DetailField label="Total items" value={formatNumber(selectedOrder.total_items)} />
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-rose-500">Detalle de productos</h3>
                <div className="mt-3 space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <ItemDetail key={String(item.cartId ?? `${selectedOrder.id}-${index}`)} item={item} index={index} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-rose-500">Mensaje WhatsApp</h3>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm text-rose-800">
                  {selectedOrder.whatsapp_message}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-rose-500">JSON completo de items</h3>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-rose-100 bg-stone-950 p-4 text-xs text-rose-50">
                  {formatJson(selectedOrder.items)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-rose-200 text-sm font-semibold text-rose-500">
              Selecciona un pedido para ver su detalle.
            </div>
          )}
        </aside>
      </div>

      {printOrder ? (
        <PrintOrderModal
          order={printOrder}
          paperSize={printPaperSize}
          sections={printSections}
          isPrinting={isPrinting}
          onClose={closePrintModal}
          onPaperSizeChange={setPrintPaperSize}
          onSectionsChange={setPrintSections}
          onConfirm={handleConfirmPrint}
        />
      ) : null}
    </section>
  );
}
