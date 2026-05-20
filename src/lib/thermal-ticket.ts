import { familyComboDescriptions } from "../data/order-menu";
import { deliveryPaymentMethodLabels } from "../constants/app";
import type { DeliveryPaymentMethod, DeliveryType, SaleOrderItem } from "../types";

export type ReceiptPaperSize = "80mm" | "56mm";

export type TicketSectionKey = "kitchen" | "receipt" | "thanks";

export type TicketSectionSelection = Record<TicketSectionKey, boolean>;

export type TicketItem = {
  name: string;
  qty: number;
  price?: number;
  notes?: string[];
};

export type TicketTotalLine = {
  label: string;
  value: number;
  negative?: boolean;
};

export type TicketSection =
  | {
      type: "comanda";
      title: string;
      date: string;
      heading: string;
      meta: string[];
      items: TicketItem[];
      summary: string[];
    }
  | {
      type: "boleta";
      title: string;
      businessName: string;
      date: string;
      meta: string[];
      items: TicketItem[];
      totals: TicketTotalLine[];
      total: number;
    }
  | {
      type: "gracias";
      lines: string[];
      imagePath?: string;
    }
  | {
      type: "cierre-diario";
      title: string;
      businessName: string;
      dateRange: string;
      summary: TicketTotalLine[];
      totalCollected: number;
      totalSales: number;
      sales: TicketItem[];
    }
  | {
      type: "evento";
      title: string;
      businessName: string;
      date: string;
      studentName: string;
      burgerName: string;
      removedIngredients: string[];
      message: string;
      lineSpacing?: number;
    };

export type TicketPrintJob = {
  businessName: string;
  paperSize: ReceiptPaperSize;
  logoPath?: string;
  sections: TicketSection[];
};

export type TicketOrderInput = {
  businessName?: string;
  paperSize: ReceiptPaperSize;
  sections: TicketSectionSelection;
  createdAt?: string;
  client?: string;
  detail?: string;
  paymentLabel?: string;
  deliveryType?: DeliveryType;
  deliveryAddress?: string;
  deliveryFee?: number;
  deliveryPaymentMethod?: DeliveryPaymentMethod;
  discountAmount?: number;
  fulfillmentTime?: string;
  items: SaleOrderItem[];
  productTotal: number;
  total: number;
};

export type DailyReportTicketInput = {
  businessName?: string;
  paperSize: ReceiptPaperSize;
  title?: string;
  dateRange: string;
  salesCount: number;
  cashTotal: number;
  cardTotal: number;
  pendingTotal: number;
  deliveryTotal: number;
  totalCollected: number;
  totalSales: number;
  sales?: {
    time: string;
    client: string;
    total: number;
    status: string;
    deliveryFee?: number;
  }[];
  productStats?: {
    name: string;
    quantity: number;
    total: number;
  }[];
};

export type EventTicketInput = {
  businessName?: string;
  paperSize: ReceiptPaperSize;
  studentName: string;
  burgerName: string;
  removedIngredients: string[];
  message?: string;
  lineSpacing?: number;
};

export type TestTicketInput = {
  businessName?: string;
  paperSize: ReceiptPaperSize;
  logoPath?: string;
};

export type ThanksTestTicketInput = {
  businessName?: string;
  paperSize: ReceiptPaperSize;
  imagePath: string;
};

const defaultBusinessName = "Ceese Burger's";

const formatTicketCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

const getFamilyBurgerNotes = (item: Pick<SaleOrderItem, "familyBurgers">) =>
  item.familyBurgers
    ?.filter((burger) => burger.removedIngredients?.length)
    .map((burger) => `${burger.label}: sin ${burger.removedIngredients?.join(", ")}`) ?? [];

const isFamilyCombo = (name: string) => Boolean(familyComboDescriptions[name]);

const shouldShowSauce = (item: Pick<SaleOrderItem, "name" | "sauce">) => Boolean(item.sauce && !isFamilyCombo(item.name));

const getItemNotes = (item: SaleOrderItem) =>
  [
    familyComboDescriptions[item.name] ? `Incluye: ${familyComboDescriptions[item.name]}` : "",
    item.drink ? `Bebida: ${item.drink}` : "",
    shouldShowSauce(item) ? `Salsa: ${item.sauce}` : "",
    item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
    ...getFamilyBurgerNotes(item),
  ].filter(Boolean);

const getKitchenGroups = (items: SaleOrderItem[]) => {
  const groups = new Map<string, TicketItem>();

  for (const item of items) {
    const notes = getItemNotes(item);
    const key = [item.name, notes.join("|")].join("::");
    const existing = groups.get(key);

    if (existing) {
      existing.qty += item.quantity;
      continue;
    }

    groups.set(key, {
      name: item.name,
      qty: item.quantity,
      notes,
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

    const itemSauce = shouldShowSauce(item) ? item.sauce : undefined;
    if (itemSauce) {
      sauces.set(itemSauce, (sauces.get(itemSauce) ?? 0) + item.quantity);
    }
  }

  return [
    fries > 0 ? `Papas: ${fries}` : "",
    ...Array.from(drinks.entries()).map(([drink, quantity]) => `${quantity} x ${drink}`),
    ...Array.from(sauces.entries()).map(([sauce, quantity]) => `${quantity} x ${sauce}`),
  ].filter(Boolean);
};

export const buildTicketData = (order: TicketOrderInput): TicketPrintJob => {
  const businessName = order.businessName ?? defaultBusinessName;
  const date = order.createdAt ? new Date(order.createdAt).toLocaleString("es-CL") : new Date().toLocaleString("es-CL");
  const deliveryType = order.deliveryType ?? "retiro";
  const deliveryFee = deliveryType === "delivery" ? order.deliveryFee ?? 0 : 0;
  const discountAmount = order.discountAmount ?? 0;
  const meta = [
    order.client?.trim() ? `Nombre: ${order.client.trim()}` : "",
    order.fulfillmentTime?.trim() ? `Hora entrega: ${order.fulfillmentTime.trim()}` : "",
    `Pago: ${order.paymentLabel ?? "Pendiente"}`,
    `Entrega: ${deliveryType === "delivery" ? "Delivery" : "Retiro"}`,
    deliveryType === "delivery" && order.deliveryAddress?.trim() ? `Direccion: ${order.deliveryAddress.trim()}` : "",
    deliveryType === "delivery" ? `Valor delivery: ${formatTicketCurrency(deliveryFee)}` : "",
    deliveryType === "delivery" && order.deliveryPaymentMethod
      ? `Pago delivery: ${deliveryPaymentMethodLabels[order.deliveryPaymentMethod]}`
      : "",
    order.detail?.trim() ? `Detalle: ${order.detail.trim()}` : "",
  ].filter(Boolean);
  const sections: TicketSection[] = [];

  if (order.sections.kitchen) {
    sections.push({
      type: "comanda",
      title: "Comanda",
      date,
      heading: order.fulfillmentTime?.trim() || "Ahora",
      meta: [
        order.client?.trim() ? `Pedido: ${order.client.trim()}` : "",
        `Entrega: ${deliveryType === "delivery" ? "Delivery" : "Retiro"}`,
        deliveryType === "delivery" && order.deliveryAddress?.trim() ? `Direccion: ${order.deliveryAddress.trim()}` : "",
        deliveryType === "delivery" && order.deliveryPaymentMethod
          ? `Pago delivery: ${deliveryPaymentMethodLabels[order.deliveryPaymentMethod]}`
          : "",
        order.detail?.trim() ? `Nota: ${order.detail.trim()}` : "",
      ].filter(Boolean),
      items: getKitchenGroups(order.items),
      summary: getKitchenSummary(order.items),
    });
  }

  if (order.sections.receipt) {
    sections.push({
      type: "boleta",
      title: "Boleta",
      businessName,
      date,
      meta,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.quantity,
        price: item.total,
        notes: getItemNotes(item),
      })),
      totals: [
        deliveryType === "delivery" || discountAmount > 0 ? { label: "Subtotal", value: order.productTotal } : undefined,
        discountAmount > 0 ? { label: "Descuento", value: discountAmount, negative: true } : undefined,
        deliveryType === "delivery" ? { label: "Delivery", value: deliveryFee } : undefined,
      ].filter((line): line is TicketTotalLine => Boolean(line)),
      total: order.total,
    });
  }

  if (order.sections.thanks) {
    sections.push({
      type: "gracias",
      lines: ["Muchas gracias", "Que las disfrute", businessName],
      imagePath: "ceeseburgito.jpeg",
    });
  }

  return {
    businessName,
    paperSize: order.paperSize,
    sections,
  };
};

export const buildDailyReportTicketData = (report: DailyReportTicketInput): TicketPrintJob => {
  const businessName = report.businessName ?? defaultBusinessName;

  return {
    businessName,
    paperSize: report.paperSize,
    sections: [
      {
        type: "cierre-diario",
        title: report.title ?? "Cierre diario",
        businessName,
        dateRange: report.dateRange,
        summary: [
          { label: "Ventas", value: report.salesCount },
          { label: "Efectivo", value: report.cashTotal },
          { label: "Debito / transf.", value: report.cardTotal },
          { label: "Pendiente", value: report.pendingTotal },
          { label: "Delivery cobrado", value: report.deliveryTotal },
        ],
        totalCollected: report.totalCollected,
        totalSales: report.totalSales,
        sales:
          report.productStats?.map((product) => ({
            name: product.name,
            qty: product.quantity,
            price: product.total,
          })) ??
          (report.sales ?? []).map((sale) => ({
            name: `${sale.time} - ${sale.client || "Sin cliente"}`,
            qty: 1,
            price: sale.total,
            notes: [sale.status, sale.deliveryFee ? `Delivery ${formatTicketCurrency(sale.deliveryFee)}` : ""].filter(Boolean),
          })),
      },
    ],
  };
};

export const buildEventTicketData = (eventTicket: EventTicketInput): TicketPrintJob => {
  const businessName = eventTicket.businessName ?? defaultBusinessName;
  const studentName = eventTicket.studentName.trim();

  return {
    businessName,
    paperSize: eventTicket.paperSize,
    sections: [
      {
        type: "evento",
        title: "Boleta evento",
        businessName,
        date: new Date().toLocaleString("es-CL"),
        studentName,
        burgerName: eventTicket.burgerName,
        removedIngredients: eventTicket.removedIngredients,
        message: eventTicket.message ?? `Feliz Día del Estudiante ${studentName}, 8° E, Instituto Claret`,
        lineSpacing: eventTicket.lineSpacing,
      },
    ],
  };
};

export const buildTestTicketData = (testTicket: TestTicketInput): TicketPrintJob => {
  const businessName = testTicket.businessName ?? defaultBusinessName;

  return {
    businessName,
    paperSize: testTicket.paperSize,
    logoPath: testTicket.logoPath,
    sections: [
      {
        type: "boleta",
        title: "Boleta de prueba",
        businessName,
        date: new Date().toLocaleString("es-CL"),
        meta: ["Cliente: Prueba de impresion", `Papel: ${testTicket.paperSize}`, "Logo: horizontal"],
        items: [
          {
            name: "Hamburguesa test",
            qty: 1,
            price: 5990,
            notes: ["Nota: sin cambios de ingredientes"],
          },
          {
            name: "Papas test",
            qty: 1,
            price: 1990,
          },
        ],
        totals: [{ label: "Subtotal", value: 7980 }],
        total: 7980,
      },
      {
        type: "gracias",
        lines: ["Prueba de margen", "Ceese Burger's"],
      },
    ],
  };
};

export const buildThanksTestTicketData = (testTicket: ThanksTestTicketInput): TicketPrintJob => {
  const businessName = testTicket.businessName ?? defaultBusinessName;

  return {
    businessName,
    paperSize: testTicket.paperSize,
    sections: [
      {
        type: "gracias",
        imagePath: testTicket.imagePath,
        lines: ["Muchas gracias", "Que las disfrute", businessName],
      },
    ],
  };
};
