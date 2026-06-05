import { deliveryPaymentMethodLabels, movementCategoryLabels, movementPaymentMethodLabels, movementTypeLabels } from "../constants/app";
import { familyComboDescriptions } from "../data/order-menu";
import type { InventoryItem, Purchase, Sale } from "../types";
import { getFamilyBurgerNotes } from "./order-notes";
import { getSaleDeliveryFee, getSaleDiscountAmount, getSaleExtraAmount, getSaleNetTotal } from "./sales";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);

export const formatPercent = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export const purchaseRowsToCsv = (rows: Purchase[]) => {
  const header = ["ID", "FECHA", "TIPO", "CATEGORIA", "DETALLE", "CANTIDAD", "UNIDAD", "MONTO", "MEDIO_PAGO"];
  const body = rows.map((row) =>
    [
      row.id,
      row.date,
      row.movementType ? movementTypeLabels[row.movementType] : row.entryType ?? "expense",
      row.category ? movementCategoryLabels[row.category] : "",
      row.detail,
      row.quantity,
      row.unit ?? "unidad",
      row.amount ?? row.total,
      row.paymentMethod ? movementPaymentMethodLabels[row.paymentMethod] : row.supplier,
    ]
      .map(escapeCell)
      .join(","),
  );

  return [header.join(","), ...body].join("\n");
};

export const salesRowsToCsv = (rows: Sale[]) => {
  const header = [
    "FECHA",
    "CLIENTE",
    "PEDIDO",
    "DETALLE",
    "ENTREGA",
    "DIRECCION",
    "HORA ENTREGA",
    "DELIVERY",
    "PAGO_DELIVERY",
    "DESCUENTO",
    "AGREGADO",
    "TOTAL",
    "TOTAL_COBRADO",
    "PAGO_EFECTIVO",
    "PAGO_DEBITO",
    "ESTADO",
  ];
  const body = rows.map((row) => {
    const orderText =
      row.orderItems
        ?.map((item) => {
          const notes = [
            familyComboDescriptions[item.name] ? `Incluye: ${familyComboDescriptions[item.name]}` : "",
            item.drink ? `Bebida: ${item.drink}` : "",
            item.sauce ? `Salsa: ${item.sauce}` : "",
            item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
            ...getFamilyBurgerNotes(item.familyBurgers),
          ]
            .filter(Boolean)
            .join(" · ");

          return `${item.quantity} x ${item.name}${notes ? ` (${notes})` : ""}`;
        })
        .join(" | ") || row.productName || row.detail;

    return [
      row.date,
      row.client,
      orderText,
      row.detail,
      row.deliveryType ?? "retiro",
      row.deliveryAddress ?? "",
      row.fulfillmentTime ?? "",
      getSaleDeliveryFee(row),
      row.deliveryPaymentMethod ? deliveryPaymentMethodLabels[row.deliveryPaymentMethod] : "",
      getSaleDiscountAmount(row),
      getSaleExtraAmount(row),
      getSaleNetTotal(row),
      row.total,
      row.cashAmount ?? "",
      row.transferAmount ?? "",
      row.status,
    ]
      .map(escapeCell)
      .join(",");
  });

  return [header.join(","), ...body].join("\n");
};

export const inventoryRowsToCsv = (rows: InventoryItem[]) => {
  const header = ["fecha", "nombre", "tipo_item", "control_stock", "cantidad", "lugar", "precio_unitario", "total"];
  const body = rows.map((row) =>
    [row.date, row.name, row.itemType ?? "", row.stockControl ?? "", row.quantity, row.place, row.unitPrice, row.total].map(escapeCell).join(","),
  );

  return [header.join(","), ...body].join("\n");
};
