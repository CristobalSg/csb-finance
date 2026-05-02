import type { InventoryItem, Purchase, Sale } from "../types";
import { getSaleDeliveryFee, getSaleDiscountAmount, getSaleNetTotal } from "./sales";

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
  const header = ["FECHA", "DETALLE", "TIPO", "ITEM", "AFECTA_INVENTARIO", "CONTROL_STOCK", "Cantidad", "Categoría", "LUGAR", "PRECIO", "TOTAL"];
  const body = rows.map((row) =>
    [
      row.date,
      row.detail,
      row.entryType ?? "expense",
      row.itemType ?? "operating_expense",
      row.affectsInventory ? "SI" : "NO",
      row.stockControl ?? "",
      row.quantity,
      "",
      row.supplier,
      row.unitPrice,
      row.total,
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
    "DESCUENTO",
    "TOTAL",
    "TOTAL_COBRADO",
    "ESTADO",
  ];
  const body = rows.map((row) => {
    const orderText =
      row.orderItems
        ?.map((item) => {
          const notes = [
            item.drink ? `Bebida: ${item.drink}` : "",
            item.sauce ? `Salsa: ${item.sauce}` : "",
            item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
            ...(item.familyBurgers
              ?.filter((burger) => burger.removedIngredients?.length)
              .map((burger) => `${burger.label}: sin ${burger.removedIngredients?.join(", ")}`) ?? []),
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
      getSaleDiscountAmount(row),
      getSaleNetTotal(row),
      row.total,
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
