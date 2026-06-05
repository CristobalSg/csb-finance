import { useCallback, useEffect, useMemo, useState } from "react";

import { PaginationControls } from "../components/common/PaginationControls";
import { CheckIcon, XIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { formatCurrency, formatNumber } from "../lib/format";
import { fetchOrders, updateOrderStatus } from "../lib/orders";
import type {
  DeliveryType,
  SaleFromOrderInput,
  SaleOrderFamilyBurger,
  SaleOrderItem,
  SupabaseOrder,
  SupabaseOrderItem,
  SupabaseOrderStatus,
} from "../types";

const statusOptions: SupabaseOrderStatus[] = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];
const pageSize = 5;

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

const normalizeNoteText = (value: string) =>
  value
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isPlaceholderOrderDetailNote = (value: string) => {
  const normalized = normalizeNoteText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:.]+$/g, "")
    .trim();

  return normalized === "detalle del pedido";
};

const sanitizeOrderNote = (value: string) => {
  const normalized = normalizeNoteText(value);
  return normalized && !isPlaceholderOrderDetailNote(normalized) ? normalized : "";
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
    return asStringArray(rawNotes).map(sanitizeOrderNote).filter(Boolean).join(", ");
  }

  return typeof rawNotes === "string" ? sanitizeOrderNote(rawNotes) : "";
};

const mapOrderItemsToSaleItems = (items: SupabaseOrderItem[], orderDetail = ""): SaleOrderItem[] =>
  items.map((item) => {
    const selections = flattenSelectionLabels(item.selections).map(sanitizeOrderNote).filter(Boolean);
    const unitSelections = flattenSelectionLabels(item.unitSelections).map(sanitizeOrderNote).filter(Boolean);
    const notes = [getItemNotes(item), ...selections, ...unitSelections].filter(Boolean).join(" · ");
    const shouldDropDuplicatedDetail =
      notes && orderDetail && normalizeNoteText(notes).toLowerCase() === normalizeNoteText(orderDetail).toLowerCase();

    return {
      name: item.title ?? item.productId ?? "Producto sin nombre",
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      total: Number(item.lineTotal ?? 0),
      removedIngredients: asStringArray(item.removals),
      familyBurgers: getUnitRemovals(item.unitRemovals),
      notes: shouldDropDuplicatedDetail ? "" : notes,
    };
  });

const getExplicitOrderDetail = (order: SupabaseOrder) => {
  const fields = [
    order.metadata?.detail,
    order.metadata?.note,
    order.metadata?.notes,
    order.metadata?.orderDetail,
    order.metadata?.customerNote,
    order.metadata?.customer_note,
    order.metadata?.comment,
    order.metadata?.comments,
    order.metadata?.instructions,
    order.metadata?.specialInstructions,
    order.metadata?.special_instructions,
  ];

  const detail = fields.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return detail?.trim() ?? "";
};

const getLocalDateFromIso = (value: string) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = parsedDate.getFullYear();
  const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsedDate.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getInitialOrderDeliveryFee = (order: SupabaseOrder) => (order.delivery_fee > 0 ? order.delivery_fee : 2500);

const buildSaleFromOrder = (
  order: SupabaseOrder,
  options: { deliveryFee?: number; total?: number } = {},
): SaleFromOrderInput => {
  const detail = getExplicitOrderDetail(order);
  const items = mapOrderItemsToSaleItems(order.items, detail);
  const deliveryType: DeliveryType = order.order_type === "delivery" ? "delivery" : "retiro";
  const productName = items.map((item) => `${item.quantity}x ${item.name}`).join(" | ");
  const deliveryFee = deliveryType === "delivery" ? options.deliveryFee ?? order.delivery_fee : 0;

  return {
    id: `order:${order.id}`,
    createdAt: order.created_at,
    date: getLocalDateFromIso(order.created_at),
    client: order.customer_name,
    detail,
    total: options.total ?? order.total,
    status: "pendiente",
    deliveryType,
    deliveryAddress: order.address ?? "",
    deliveryFee,
    orderItems: items,
    quantity: Math.max(1, order.total_items || items.reduce((total, item) => total + item.quantity, 0)),
    productName,
  };
};

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

function ConfirmOrderModal({
  order,
  deliveryFee,
  isConfirming,
  onClose,
  onDeliveryFeeChange,
  onConfirm,
}: {
  order: SupabaseOrder;
  deliveryFee: string;
  isConfirming: boolean;
  onClose: () => void;
  onDeliveryFeeChange: (deliveryFee: string) => void;
  onConfirm: () => void;
}) {
  const isDelivery = order.order_type === "delivery";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckIcon />
            </div>
            <div>
              <p className="text-sm font-medium text-rose-500">Pedidos</p>
              <h3 className="mt-1 text-xl font-bold text-rose-950">Confirmar pedido</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
            aria-label="Cerrar confirmacion"
          >
            <XIcon />
          </button>
        </div>

        <div className="mt-5 min-h-0 overflow-auto pr-1">
          <div className="rounded-[1.25rem] bg-rose-50/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-rose-950">{order.customer_name || "Sin cliente"}</p>
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  {orderTypeLabels[order.order_type]} · {formatDateTime(order.created_at)}
                </p>
                {order.address ? <p className="mt-2 text-xs font-semibold text-rose-700">{order.address}</p> : null}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-black uppercase text-rose-400">Total</p>
                <p className="text-lg font-black text-rose-950">{formatCurrency(order.total)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailField label="Pago" value={paymentMethodLabels[order.payment_method]} />
            <DetailField label="Subtotal" value={formatCurrency(order.subtotal)} />
            <DetailField label="Delivery actual" value={formatCurrency(order.delivery_fee)} />
            <DetailField label="Items" value={formatNumber(order.total_items)} />
          </div>

          {isDelivery ? (
            <div className="mt-4 space-y-3">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Valor delivery</span>
                <input
                  value={deliveryFee}
                  onChange={(event) => onDeliveryFeeChange(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                  placeholder="2500"
                />
              </label>
            </div>
          ) : null}

          <div className="mt-5">
            <h4 className="text-sm font-black uppercase text-rose-500">Productos a enviar a ventas</h4>
            <div className="mt-3 space-y-3">
              {order.items.map((item, index) => (
                <ItemDetail key={String(item.cartId ?? `${order.id}-${index}`)} item={item} index={index} />
              ))}
            </div>
          </div>

          {getExplicitOrderDetail(order) ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-amber-600">Nota del pedido</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-amber-900">{getExplicitOrderDetail(order)}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex shrink-0 flex-col-reverse gap-3 border-t border-rose-100 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            disabled={isConfirming}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckIcon />
            {isConfirming ? "Confirmando" : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrdersManagementPage({
  refreshToken = 0,
  onRegisterSale,
  onOrderConfirmed,
}: {
  refreshToken?: number;
  onRegisterSale: (sale: SaleFromOrderInput) => Promise<boolean>;
  onOrderConfirmed?: () => void;
}) {
  const [orders, setOrders] = useState<SupabaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [confirmOrder, setConfirmOrder] = useState<SupabaseOrder | null>(null);
  const [confirmDeliveryFee, setConfirmDeliveryFee] = useState("2500");
  const [isConfirming, setIsConfirming] = useState(false);

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
      const order = orders.find((item) => item.id === orderId);

      if (status === "confirmed" && order) {
        openConfirmModal(order);
        return;
      }

      const updatedOrder = await updateOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No fue posible actualizar el estado.");
    } finally {
      setUpdatingId(null);
    }
  };

  const openConfirmModal = (order: SupabaseOrder) => {
    setConfirmOrder(order);
    setConfirmDeliveryFee(order.order_type === "delivery" ? String(getInitialOrderDeliveryFee(order)) : "");
  };

  const closeConfirmModal = () => {
    if (isConfirming) {
      return;
    }

    setConfirmOrder(null);
    setConfirmDeliveryFee("2500");
  };

  const handleConfirmOrder = async () => {
    if (!confirmOrder || isConfirming) {
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const deliveryType: DeliveryType = confirmOrder.order_type === "delivery" ? "delivery" : "retiro";
      const deliveryFee = deliveryType === "delivery" ? Number.parseInt(confirmDeliveryFee, 10) || 0 : 0;
      const baseTotal = deliveryType === "delivery" ? Math.max(0, confirmOrder.total - confirmOrder.delivery_fee) : confirmOrder.total;
      const total = baseTotal + deliveryFee;

      if (deliveryType === "delivery" && deliveryFee <= 0) {
        window.alert("Ingresa el valor del delivery antes de confirmar.");
        return;
      }

      const wasSaleRegistered = await onRegisterSale(
        buildSaleFromOrder(confirmOrder, {
          deliveryFee,
          total,
        }),
      );

      if (!wasSaleRegistered) {
        return;
      }

      const updatedOrder = await updateOrderStatus(confirmOrder.id, "confirmed");
      setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
      setSelectedOrderId(updatedOrder.id);
      setConfirmOrder(null);
      setConfirmDeliveryFee("2500");
      onOrderConfirmed?.();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "No fue posible confirmar el pedido.");
      window.alert(confirmError instanceof Error ? confirmError.message : "No fue posible confirmar el pedido.");
    } finally {
      setIsConfirming(false);
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
                            openConfirmModal(order);
                          }}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-fuchsia-600 transition hover:border-fuchsia-200 hover:bg-fuchsia-50"
                          aria-label="Confirmar pedido"
                        >
                          <CheckIcon />
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

      {confirmOrder ? (
        <ConfirmOrderModal
          order={confirmOrder}
          deliveryFee={confirmDeliveryFee}
          isConfirming={isConfirming}
          onClose={closeConfirmModal}
          onDeliveryFeeChange={setConfirmDeliveryFee}
          onConfirm={handleConfirmOrder}
        />
      ) : null}
    </section>
  );
}
