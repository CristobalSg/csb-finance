import { Fragment, type ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PaginationControls } from "../components/common/PaginationControls";
import { TableEmpty } from "../components/common/TableEmpty";
import { CopyIcon, DotsIcon, PaymentIcon, PrintIcon, XIcon } from "../components/icons";
import { deliveryPaymentMethodLabels, saleStatusLabels, shellCardClass } from "../constants/app";
import { familyComboDescriptions } from "../data/order-menu";
import { formatShortDate } from "../lib/date";
import { formatCurrency, formatNumber } from "../lib/format";
import { getSaleDeliveryFee, getSaleDiscountAmount, getSaleNetTotal } from "../lib/sales";
import { printTicket } from "../lib/thermal-printer";
import { buildDailyReportTicketData, buildTicketData, type ReceiptPaperSize } from "../lib/thermal-ticket";
import type { DeliveryPaymentMethod, DeliveryType, Sale, SaleOrderItem, SaleStatus } from "../types";

const HISTORY_PAGE_SIZE = 8;
const DAILY_REPORT_START_HOUR = 13;
const DAILY_REPORT_END_HOUR = 2;

type SalesReportPeriod = "daily" | "weekly" | "monthly";

const defaultReceiptPrintSections = {
  kitchen: false,
  receipt: true,
  thanks: true,
};

type ReceiptPrintSection = keyof typeof defaultReceiptPrintSections;

const receiptPrintSectionOptions: { key: ReceiptPrintSection; label: string }[] = [
  { key: "kitchen", label: "Comanda" },
  { key: "receipt", label: "Boleta" },
  { key: "thanks", label: "Gracias" },
];

type SaleUpdateInput = Pick<
  Sale,
  "client" | "detail" | "deliveryType" | "deliveryAddress" | "deliveryFee" | "deliveryPaymentMethod" | "fulfillmentTime"
>;

type SaleEditForm = {
  client: string;
  detail: string;
  deliveryType: DeliveryType;
  deliveryAddress: string;
  deliveryFee: string;
  deliveryPaymentMethod: DeliveryPaymentMethod;
  fulfillmentTime: string;
};

const isFamilyCombo = (name: string) => Boolean(familyComboDescriptions[name]);

const shouldShowSauce = (item: Pick<SaleOrderItem, "name" | "sauce">) => Boolean(item.sauce && !isFamilyCombo(item.name));

const getFamilyBurgerNotes = (item: Pick<SaleOrderItem, "familyBurgers">) =>
  item.familyBurgers
    ?.filter((burger) => burger.removedIngredients?.length)
    .map((burger) => `${burger.label}: sin ${burger.removedIngredients?.join(", ")}`) ?? [];

const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createLocalDateTime = (date: string, hour: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
};

const getDailyReportRange = (date: string) => {
  const start = createLocalDateTime(date, DAILY_REPORT_START_HOUR);
  const end = createLocalDateTime(date, DAILY_REPORT_END_HOUR);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const getWeeklyReportRange = (date: string) => {
  const selectedDate = createLocalDateTime(date, 0);
  const mondayOffset = (selectedDate.getDay() + 6) % 7;
  const start = createLocalDateTime(date, 0);
  start.setDate(selectedDate.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
};

const getMonthlyReportRange = (date: string) => {
  const [year, month] = date.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);

  return { start, end };
};

const getSalesReportRange = (period: SalesReportPeriod, date: string) => {
  if (period === "weekly") return getWeeklyReportRange(date);
  if (period === "monthly") return getMonthlyReportRange(date);
  return getDailyReportRange(date);
};

const salesReportPeriodLabels: Record<SalesReportPeriod, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
};

const getSalesReportTitle = (period: SalesReportPeriod) => `Cierre ${salesReportPeriodLabels[period].toLowerCase()}`;

const formatReportDateTime = (date: Date) =>
  date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const isSaleInReportRange = (sale: Sale, period: SalesReportPeriod, date: string) => {
  const createdAt = new Date(sale.createdAt);
  const { start, end } = getSalesReportRange(period, date);
  return createdAt >= start && createdAt < end;
};

const formatSaleOrderItems = (sale: Sale) => {
  if (sale.orderItems && sale.orderItems.length > 0) {
    return sale.orderItems;
  }

  return [
    {
      name: sale.productName || sale.detail || "Pedido",
      quantity: sale.quantity || 1,
      unitPrice: getSaleNetTotal(sale),
      total: getSaleNetTotal(sale),
    },
  ] satisfies SaleOrderItem[];
};

const getSalePaymentLabel = (sale: Sale) => {
  if (sale.status !== "mixto") {
    return saleStatusLabels[sale.status];
  }

  return `${saleStatusLabels[sale.status]}: Efectivo ${formatCurrency(sale.cashAmount ?? 0)} · Debito ${formatCurrency(sale.transferAmount ?? 0)}`;
};

const getProductSalesStats = (sales: Sale[]) => {
  const products = new Map<string, { name: string; quantity: number; total: number }>();

  for (const sale of sales) {
    for (const item of formatSaleOrderItems(sale)) {
      const existing = products.get(item.name) ?? { name: item.name, quantity: 0, total: 0 };
      products.set(item.name, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        total: existing.total + item.total,
      });
    }
  }

  return Array.from(products.values()).sort((first, second) => second.quantity - first.quantity || second.total - first.total);
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
      familyBurgerNotes: string[];
    }
  >();

  for (const item of items) {
    const removedIngredients = [...(item.removedIngredients ?? [])].sort((a, b) => a.localeCompare(b));
    const familyBurgerNotes = getFamilyBurgerNotes(item);
    const itemSauce = shouldShowSauce(item) ? item.sauce : undefined;
    const key = [item.name, item.drink ?? "", itemSauce ?? "", removedIngredients.join("|"), familyBurgerNotes.join("|")].join("::");
    const existing = groups.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    groups.set(key, {
      name: item.name,
      quantity: item.quantity,
      drinks: item.drink ? [item.drink] : [],
      sauces: itemSauce ? [itemSauce] : [],
      removedIngredients,
      familyBurgerNotes,
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

  return {
    drinks: Array.from(drinks.entries()),
    sauces: Array.from(sauces.entries()),
    fries,
  };
};

export function SalesSection({
  loading,
  sales,
  receiptLogoPath,
  onDelete,
  onUpdateStatus,
  onUpdateSale,
  onExport,
  onImport,
  realMoneyTotals,
}: {
  loading: boolean;
  sales: Sale[];
  receiptLogoPath: string;
  realMoneyTotals: {
    cash: number;
    debit: number;
    total: number;
  };
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: SaleStatus, paymentAmounts?: { cashAmount?: number; transferAmount?: number }) => void;
  onUpdateSale: (id: string, updates: SaleUpdateInput) => void;
  onExport: () => void;
  onImport: (csvContent: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptPrintSections, setReceiptPrintSections] = useState(defaultReceiptPrintSections);
  const [receiptPaperSize, setReceiptPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [dailyReportDate, setDailyReportDate] = useState(getDateInputValue);
  const [salesReportPeriod, setSalesReportPeriod] = useState<SalesReportPeriod>("daily");
  const [dailyReportPaperSize, setDailyReportPaperSize] = useState<ReceiptPaperSize>("56mm");
  const [includeRealMoneyStats, setIncludeRealMoneyStats] = useState(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [actionsSaleId, setActionsSaleId] = useState<string | null>(null);
  const [copiedSaleId, setCopiedSaleId] = useState<string | null>(null);
  const [mixedCashAmount, setMixedCashAmount] = useState("");
  const [mixedTransferAmount, setMixedTransferAmount] = useState("");
  const [saleEditForm, setSaleEditForm] = useState<SaleEditForm>({
    client: "",
    detail: "",
    deliveryType: "retiro",
    deliveryAddress: "",
    deliveryFee: "",
    deliveryPaymentMethod: "efectivo",
    fulfillmentTime: "",
  });

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

  const openReprintReceipt = (sale: Sale) => {
    setReceiptSale(sale);
    setReceiptPrintSections(defaultReceiptPrintSections);
    setReceiptPaperSize("80mm");
  };

  const copySaleLocation = async (sale: Sale) => {
    const location = sale.deliveryType === "delivery" ? sale.deliveryAddress || "Delivery sin direccion" : "Retiro en local";
    const text = [`Nombre: ${sale.client || "Sin cliente"}`, `Lugar: ${location}`].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSaleId(sale.id);
      window.setTimeout(() => setCopiedSaleId((current) => (current === sale.id ? null : current)), 1600);
    } catch {
      window.alert("No fue posible copiar los datos del pedido.");
    }
  };

  const openEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setSaleEditForm({
      client: sale.client,
      detail: sale.detail,
      deliveryType: sale.deliveryType ?? "retiro",
      deliveryAddress: sale.deliveryAddress ?? "",
      deliveryFee: sale.deliveryFee ? String(sale.deliveryFee) : "",
      deliveryPaymentMethod: sale.deliveryPaymentMethod ?? "efectivo",
      fulfillmentTime: sale.fulfillmentTime ?? "",
    });
  };

  const closeEditSale = () => {
    setEditingSale(null);
    setSaleEditForm({
      client: "",
      detail: "",
      deliveryType: "retiro",
      deliveryAddress: "",
      deliveryFee: "",
      deliveryPaymentMethod: "efectivo",
      fulfillmentTime: "",
    });
  };

  const closePaymentModal = () => {
    setPaymentSale(null);
    setMixedCashAmount("");
    setMixedTransferAmount("");
  };

  const openPaymentModal = (sale: Sale) => {
    setActionsSaleId(null);
    setPaymentSale(sale);
    setMixedCashAmount(sale.cashAmount ? String(sale.cashAmount) : "");
    setMixedTransferAmount(sale.transferAmount ? String(sale.transferAmount) : "");
  };

  const getClampedPaymentAmount = (rawValue: string, saleTotal: number) => {
    const numericValue = Number.parseInt(rawValue.replace(/\D/g, ""), 10) || 0;
    return Math.min(numericValue, saleTotal);
  };

  const handleMixedCashChange = (rawValue: string) => {
    if (!paymentSale) {
      return;
    }

    const saleTotal = getSaleNetTotal(paymentSale);
    const cashAmount = getClampedPaymentAmount(rawValue, saleTotal);
    setMixedCashAmount(cashAmount > 0 ? String(cashAmount) : "");
    setMixedTransferAmount(String(saleTotal - cashAmount));
  };

  const handleMixedTransferChange = (rawValue: string) => {
    if (!paymentSale) {
      return;
    }

    const saleTotal = getSaleNetTotal(paymentSale);
    const transferAmount = getClampedPaymentAmount(rawValue, saleTotal);
    setMixedTransferAmount(transferAmount > 0 ? String(transferAmount) : "");
    setMixedCashAmount(String(saleTotal - transferAmount));
  };

  const handleDirectPayment = (status: Extract<SaleStatus, "efectivo" | "transferencia">) => {
    if (!paymentSale) {
      return;
    }

    onUpdateStatus(paymentSale.id, status);
    closePaymentModal();
  };

  const updateSaleEditDeliveryType = (nextDeliveryType: DeliveryType) => {
    setSaleEditForm((current) => ({
      ...current,
      deliveryType: nextDeliveryType,
      deliveryFee: nextDeliveryType === "delivery" ? current.deliveryFee || "2500" : current.deliveryFee,
    }));
  };

  const handleMixedPayment = () => {
    if (!paymentSale) {
      return;
    }

    const cashAmount = Number.parseInt(mixedCashAmount, 10) || 0;
    const transferAmount = Number.parseInt(mixedTransferAmount, 10) || 0;
    const saleTotal = getSaleNetTotal(paymentSale);

    if (cashAmount <= 0 || transferAmount <= 0) {
      window.alert("Ingresa monto en efectivo y monto debito/transferencia.");
      return;
    }

    if (cashAmount + transferAmount !== saleTotal) {
      window.alert(`El pago mixto debe sumar ${formatCurrency(saleTotal)}.`);
      return;
    }

    onUpdateStatus(paymentSale.id, "mixto", { cashAmount, transferAmount });
    closePaymentModal();
  };

  const handleSaveSaleEdit = () => {
    if (!editingSale) {
      return;
    }

    const deliveryFee = saleEditForm.deliveryType === "delivery" ? Number.parseInt(saleEditForm.deliveryFee, 10) || 0 : undefined;

    onUpdateSale(editingSale.id, {
      client: saleEditForm.client,
      detail: saleEditForm.detail,
      deliveryType: saleEditForm.deliveryType,
      deliveryAddress: saleEditForm.deliveryType === "delivery" ? saleEditForm.deliveryAddress : "",
      deliveryFee,
      deliveryPaymentMethod: saleEditForm.deliveryType === "delivery" ? saleEditForm.deliveryPaymentMethod : undefined,
      fulfillmentTime: saleEditForm.fulfillmentTime,
    });
    closeEditSale();
  };

  const closeReprintReceipt = () => {
    setReceiptSale(null);
    setReceiptPrintSections(defaultReceiptPrintSections);
    setReceiptPaperSize("80mm");
  };

  const handleReprintReceipt = async () => {
    if (!receiptSale) {
      return;
    }

    if (!receiptPrintSections.kitchen && !receiptPrintSections.receipt && !receiptPrintSections.thanks) {
      window.alert("Selecciona al menos una hoja para imprimir.");
      return;
    }

    try {
      await printTicket(
        buildTicketData({
          paperSize: receiptPaperSize,
          logoPath: receiptLogoPath,
          sections: receiptPrintSections,
          createdAt: receiptSale.createdAt,
          client: receiptSale.client,
          detail: receiptSale.detail,
          paymentLabel: getSalePaymentLabel(receiptSale),
          deliveryType: receiptSale.deliveryType ?? "retiro",
          deliveryAddress: receiptSale.deliveryAddress,
          deliveryFee: getSaleDeliveryFee(receiptSale),
          deliveryPaymentMethod: receiptSale.deliveryPaymentMethod,
          discountAmount: getSaleDiscountAmount(receiptSale),
          fulfillmentTime: receiptSale.fulfillmentTime,
          items: receiptItems,
          productTotal: receiptProductTotal,
          total: receiptSale.total,
        }),
      );
      closeReprintReceipt();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible reimprimir el ticket ESC/POS.");
    }
  };

  const receiptItems = receiptSale ? formatSaleOrderItems(receiptSale) : [];
  const receiptProductTotal = receiptItems.reduce((total, item) => total + item.total, 0);
  const kitchenGroups = getKitchenGroups(receiptItems);
  const kitchenSummary = getKitchenSummary(receiptItems);
  const dailyReportRange = getSalesReportRange(salesReportPeriod, dailyReportDate);
  const shouldIncludeRealMoneyStats = salesReportPeriod === "weekly" && includeRealMoneyStats;
  const dailyReportSales = useMemo(
    () =>
      sales
        .filter((sale) => isSaleInReportRange(sale, salesReportPeriod, dailyReportDate))
        .sort((first, second) => first.createdAt.localeCompare(second.createdAt)),
    [dailyReportDate, sales, salesReportPeriod],
  );
  const dailyReportProductStats = useMemo(() => getProductSalesStats(dailyReportSales), [dailyReportSales]);
  const dailyReportTotals = useMemo(
    () => ({
      efectivo: dailyReportSales.reduce((total, sale) => {
        if (sale.status === "efectivo") return total + getSaleNetTotal(sale);
        if (sale.status === "mixto") return total + (sale.cashAmount ?? 0);
        return total;
      }, 0),
      debito: dailyReportSales.reduce((total, sale) => {
        if (sale.status === "transferencia") return total + getSaleNetTotal(sale);
        if (sale.status === "mixto") return total + (sale.transferAmount ?? 0);
        return total;
      }, 0),
      pendiente: dailyReportSales.filter((sale) => sale.status === "pendiente").reduce((total, sale) => total + getSaleNetTotal(sale), 0),
      delivery: dailyReportSales.reduce((total, sale) => total + getSaleDeliveryFee(sale), 0),
      total: dailyReportSales.reduce((total, sale) => total + getSaleNetTotal(sale), 0),
    }),
    [dailyReportSales],
  );

  const handlePrintDailyReport = async () => {
    try {
      await printTicket(
        buildDailyReportTicketData({
          paperSize: dailyReportPaperSize,
          logoPath: receiptLogoPath,
          title: getSalesReportTitle(salesReportPeriod),
          dateRange: `${formatReportDateTime(dailyReportRange.start)} a ${formatReportDateTime(dailyReportRange.end)}`,
          salesCount: dailyReportSales.length,
          cashTotal: dailyReportTotals.efectivo,
          cardTotal: dailyReportTotals.debito,
          pendingTotal: dailyReportTotals.pendiente,
          deliveryTotal: dailyReportTotals.delivery,
          totalCollected: dailyReportTotals.efectivo + dailyReportTotals.debito,
          totalSales: dailyReportTotals.total,
          cashSnapshot: shouldIncludeRealMoneyStats
            ? {
                cash: realMoneyTotals.cash,
                debit: realMoneyTotals.debit,
                total: realMoneyTotals.total,
              }
            : undefined,
          sales:
            salesReportPeriod === "daily"
              ? dailyReportSales.map((sale) => ({
                  time: new Date(sale.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
                  client: sale.client,
                  total: getSaleNetTotal(sale),
                  status: saleStatusLabels[sale.status],
                  deliveryFee: getSaleDeliveryFee(sale),
                }))
              : undefined,
          productStats:
            salesReportPeriod === "daily"
              ? undefined
              : dailyReportProductStats.map((product) => ({
                  name: product.name,
                  quantity: product.quantity,
                  total: product.total,
                })),
        }),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible imprimir el cierre ESC/POS.");
    }
  };

  return (
    <section id="ventas" className="flex h-full min-h-0 flex-col space-y-4">
      {isDailyReportOpen ? (
        <div data-receipt-preview-source aria-hidden="true" className="pointer-events-none fixed left-[-9999px] top-0">
          <div className="receipt-paper">
            <div className="text-center">
              <p className="text-xs font-black uppercase">{getSalesReportTitle(salesReportPeriod)}</p>
              <p className="mt-1 text-[11px] font-bold">Ceese Burger's</p>
              <p className="mt-2 text-xs font-bold">
                {formatReportDateTime(dailyReportRange.start)} a {formatReportDateTime(dailyReportRange.end)}
              </p>
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="receipt-cut space-y-1 text-xs font-bold">
              <div className="flex justify-between gap-2">
                <span>Ventas</span>
                <span>{dailyReportSales.length}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Efectivo</span>
                <span className="shrink-0">{formatCurrency(dailyReportTotals.efectivo)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Debito / transf.</span>
                <span className="shrink-0">{formatCurrency(dailyReportTotals.debito)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Pendiente</span>
                <span className="shrink-0">{formatCurrency(dailyReportTotals.pendiente)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Delivery cobrado</span>
                <span className="shrink-0">{formatCurrency(dailyReportTotals.delivery)}</span>
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="flex justify-between gap-2 text-sm font-black">
              <span>Total cobrado</span>
              <span className="shrink-0">{formatCurrency(dailyReportTotals.efectivo + dailyReportTotals.debito)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2 text-xs font-black">
              <span>Total ventas</span>
              <span className="shrink-0">{formatCurrency(dailyReportTotals.total)}</span>
            </div>

            {shouldIncludeRealMoneyStats ? (
              <>
                <div className="my-3 border-t border-dashed border-black" />
                <p className="mb-2 text-xs font-black uppercase">Dinero real</p>
                <div className="receipt-cut space-y-1 text-xs font-bold">
                  <div className="flex justify-between gap-2">
                    <span>Efectivo real</span>
                    <span className="shrink-0">{formatCurrency(realMoneyTotals.cash)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Debito real</span>
                    <span className="shrink-0">{formatCurrency(realMoneyTotals.debit)}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-sm font-black">
                    <span>Total real</span>
                    <span className="shrink-0">{formatCurrency(realMoneyTotals.total)}</span>
                  </div>
                </div>
              </>
            ) : null}

            {salesReportPeriod === "daily" && dailyReportSales.length > 0 ? (
              <>
                <div className="my-3 border-t border-dashed border-black" />
                <div className="space-y-2">
                  {dailyReportSales.map((sale) => (
                    <div key={sale.id} className="receipt-cut text-xs font-semibold">
                      <div className="flex justify-between gap-2">
                        <span>
                          {new Date(sale.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {sale.client || "Sin cliente"}
                        </span>
                        <span className="shrink-0">{formatCurrency(getSaleNetTotal(sale))}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-bold uppercase">
                        {saleStatusLabels[sale.status]}
                        {getSaleDeliveryFee(sale) > 0 ? ` · Delivery ${formatCurrency(getSaleDeliveryFee(sale))}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {salesReportPeriod !== "daily" && dailyReportProductStats.length > 0 ? (
              <>
                <div className="my-3 border-t border-dashed border-black" />
                <p className="mb-2 text-xs font-black uppercase">Productos vendidos</p>
                <div className="space-y-2">
                  {dailyReportProductStats.map((product) => (
                    <div key={product.name} className="receipt-cut text-xs font-semibold">
                      <div className="flex justify-between gap-2">
                        <span>
                          {formatNumber(product.quantity)} x {product.name}
                        </span>
                        <span className="shrink-0">{formatCurrency(product.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {receiptSale ? (
        <div data-receipt-preview-source aria-hidden="true" className="pointer-events-none fixed left-[-9999px] top-0">
          {receiptPrintSections.kitchen ? (
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
              {receiptSale.deliveryType === "delivery" && receiptSale.deliveryPaymentMethod ? (
                <p>Pago delivery: {deliveryPaymentMethodLabels[receiptSale.deliveryPaymentMethod]}</p>
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
                    {group.familyBurgerNotes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
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
          ) : null}

          {receiptPrintSections.receipt ? (
          <div className="receipt-paper">
            <div className="text-center">
              <img src={`/${receiptLogoPath}`} alt="Ceese Burger's" className="receipt-logo" />
              <p className="mt-1 text-xs font-bold">{new Date(receiptSale.createdAt).toLocaleString("es-CL")}</p>
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="receipt-cut space-y-1 text-xs font-semibold">
              {receiptSale.client.trim() ? <p>Nombre: {receiptSale.client.trim()}</p> : null}
              {receiptSale.fulfillmentTime?.trim() ? <p>Hora entrega: {receiptSale.fulfillmentTime.trim()}</p> : null}
              <p>Pago: {getSalePaymentLabel(receiptSale)}</p>
              <p>Entrega: {receiptSale.deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
              {receiptSale.deliveryType === "delivery" && receiptSale.deliveryAddress?.trim() ? (
                <p>Direccion: {receiptSale.deliveryAddress.trim()}</p>
              ) : null}
              {receiptSale.deliveryType === "delivery" ? <p>Valor delivery: {formatCurrency(receiptSale.deliveryFee ?? 0)}</p> : null}
              {receiptSale.deliveryType === "delivery" && receiptSale.deliveryPaymentMethod ? (
                <p>Pago delivery: {deliveryPaymentMethodLabels[receiptSale.deliveryPaymentMethod]}</p>
              ) : null}
              {receiptSale.detail.trim() ? <p>Detalle: {receiptSale.detail.trim()}</p> : null}
            </div>

            <div className="my-3 border-t border-dashed border-black" />

            <div className="space-y-3">
              {receiptItems.map((item, index) => {
                const notes = [
                  item.drink ? `Bebida: ${item.drink}` : "",
                  shouldShowSauce(item) ? `Salsa: ${item.sauce}` : "",
                  item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
                  ...getFamilyBurgerNotes(item),
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

            {receiptSale.deliveryType === "delivery" || getSaleDiscountAmount(receiptSale) > 0 ? (
              <div className="space-y-1 text-xs font-bold">
                <div className="flex justify-between gap-2">
                  <span>Subtotal</span>
                  <span className="shrink-0 whitespace-nowrap">{formatCurrency(receiptProductTotal)}</span>
                </div>
                {getSaleDiscountAmount(receiptSale) > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span>Descuento</span>
                    <span className="shrink-0 whitespace-nowrap">-{formatCurrency(getSaleDiscountAmount(receiptSale))}</span>
                  </div>
                ) : null}
                {receiptSale.deliveryType === "delivery" ? (
                  <div className="flex justify-between gap-2">
                    <span>Delivery</span>
                    <span className="shrink-0 whitespace-nowrap">{formatCurrency(receiptSale.deliveryFee ?? 0)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-2 flex justify-between text-sm font-black">
              <span>Total</span>
              <span className="shrink-0 whitespace-nowrap">{formatCurrency(receiptSale.total)}</span>
            </div>
          </div>
          ) : null}

          {receiptPrintSections.thanks ? (
          <div className="receipt-paper">
            <div className="receipt-thanks-layout">
              <img src="/ceeseburgito.jpeg" alt="Ceeseburguito" className="receipt-thanks-image" />
              <div className="receipt-thanks-copy">
                <p className="text-base font-black uppercase leading-tight">Muchas gracias</p>
                <p className="mt-1 text-xs font-bold">Que las disfrute</p>
                <p className="mt-1 text-sm font-black uppercase">Ceese Burger's</p>
              </div>
            </div>
          </div>
          ) : null}
        </div>
      ) : null}

      {receiptSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Ventas</p>
                <h3 className="mt-1 text-xl font-bold text-rose-950">Reimprimir pedido</h3>
              </div>
              <button
                type="button"
                onClick={closeReprintReceipt}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar seleccion de impresion"
              >
                <XIcon />
              </button>
            </div>

            <div className="mt-5 rounded-[1.25rem] bg-rose-50/60 p-4">
              <p className="text-sm font-bold text-rose-950">{receiptSale.client || "Sin cliente"}</p>
              <p className="mt-1 text-xs font-semibold text-rose-600">
                Venta {formatCurrency(getSaleNetTotal(receiptSale))}
                {getSaleDeliveryFee(receiptSale) > 0 ? ` · Delivery ${formatCurrency(getSaleDeliveryFee(receiptSale))}` : ""} ·{" "}
                {formatShortDate(receiptSale.date)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {receiptPrintSectionOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-800"
                >
                  <input
                    type="checkbox"
                    checked={receiptPrintSections[option.key]}
                    onChange={(event) =>
                      setReceiptPrintSections((current) => ({
                        ...current,
                        [option.key]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-fuchsia-600"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
              <div className="grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                {(["80mm", "56mm"] as ReceiptPaperSize[]).map((paperSize) => (
                  <button
                    key={paperSize}
                    type="button"
                    onClick={() => setReceiptPaperSize(paperSize)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      receiptPaperSize === paperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                    }`}
                  >
                    {paperSize}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeReprintReceipt}
                className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReprintReceipt}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
              >
                <PrintIcon />
                Imprimir seleccion
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDailyReportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Ventas</p>
                <h3 className="mt-1 text-xl font-bold text-rose-950">Imprimir cierre</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDailyReportOpen(false);
                  setDailyReportPaperSize("56mm");
                  setSalesReportPeriod("daily");
                  setIncludeRealMoneyStats(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar cierre diario"
              >
                <XIcon />
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Tipo de cierre</p>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-full bg-rose-50 p-1">
                {(["daily", "weekly", "monthly"] as SalesReportPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      setSalesReportPeriod(period);
                      if (period !== "weekly") {
                        setIncludeRealMoneyStats(false);
                      }
                    }}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      salesReportPeriod === period ? "bg-fuchsia-600 text-white" : "text-rose-700"
                    }`}
                  >
                    {salesReportPeriodLabels[period]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                  {salesReportPeriod === "daily" ? "Dia de venta" : "Fecha dentro del periodo"}
                </span>
                <input
                  type="date"
                  value={dailyReportDate}
                  onChange={(event) => {
                    if (event.target.value) {
                      setDailyReportDate(event.target.value);
                    }
                  }}
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                />
              </label>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                  {(["56mm", "80mm"] as ReceiptPaperSize[]).map((paperSize) => (
                    <button
                      key={paperSize}
                      type="button"
                      onClick={() => setDailyReportPaperSize(paperSize)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                        dailyReportPaperSize === paperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                      }`}
                    >
                      {paperSize}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {salesReportPeriod === "weekly" ? (
              <label className="mt-4 flex items-start gap-3 rounded-[1.25rem] border border-rose-100 bg-white/80 p-4 text-sm text-rose-800">
                <input
                  type="checkbox"
                  checked={includeRealMoneyStats}
                  onChange={(event) => setIncludeRealMoneyStats(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-fuchsia-600"
                />
                <span>
                  <span className="block font-black text-rose-950">Agregar dinero real</span>
                  <span className="mt-1 block text-xs font-semibold text-rose-600">
                    Incluye efectivo real, debito real y total real en el cierre impreso.
                  </span>
                </span>
              </label>
            ) : null}

            <div className="mt-4 rounded-[1.25rem] bg-rose-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                {salesReportPeriod === "daily" ? "Turno" : "Periodo"}
              </p>
              <p className="mt-2 text-sm font-bold text-rose-950">
                {formatReportDateTime(dailyReportRange.start)} a {formatReportDateTime(dailyReportRange.end)}
              </p>
              <div className="mt-4 grid gap-2 text-sm text-rose-800 sm:grid-cols-2">
                <div className="flex justify-between gap-3 rounded-[1rem] bg-white/70 px-3 py-2">
                  <span>Efectivo</span>
                  <span className="font-black">{formatCurrency(dailyReportTotals.efectivo)}</span>
                </div>
                <div className="flex justify-between gap-3 rounded-[1rem] bg-white/70 px-3 py-2">
                  <span>Debito</span>
                  <span className="font-black">{formatCurrency(dailyReportTotals.debito)}</span>
                </div>
                <div className="flex justify-between gap-3 rounded-[1rem] bg-white/70 px-3 py-2">
                  <span>Pendiente</span>
                  <span className="font-black">{formatCurrency(dailyReportTotals.pendiente)}</span>
                </div>
                <div className="flex justify-between gap-3 rounded-[1rem] bg-white/70 px-3 py-2">
                  <span>Delivery</span>
                  <span className="font-black">{formatCurrency(dailyReportTotals.delivery)}</span>
                </div>
                <div className="flex justify-between gap-3 rounded-[1rem] bg-white/70 px-3 py-2">
                  <span>Total cobrado</span>
                  <span className="font-black">{formatCurrency(dailyReportTotals.efectivo + dailyReportTotals.debito)}</span>
                </div>
              </div>
              {shouldIncludeRealMoneyStats ? (
                <div className="mt-3 grid gap-2 rounded-[1rem] border border-fuchsia-100 bg-white/80 p-3 text-sm text-rose-800 sm:grid-cols-3">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Efectivo real</span>
                    <span className="mt-1 block font-black">{formatCurrency(realMoneyTotals.cash)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Debito real</span>
                    <span className="mt-1 block font-black">{formatCurrency(realMoneyTotals.debit)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Total real</span>
                    <span className="mt-1 block font-black text-fuchsia-700">{formatCurrency(realMoneyTotals.total)}</span>
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs font-semibold text-rose-600">
                {formatNumber(dailyReportSales.length)} ventas en el rango seleccionado.
              </p>
            </div>

            {salesReportPeriod !== "daily" ? (
              <div className="mt-4 rounded-[1.25rem] border border-rose-100 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Mas vendido</p>
                {dailyReportProductStats.length > 0 ? (
                  <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1 text-sm text-rose-800">
                    {dailyReportProductStats.slice(0, 8).map((product) => (
                      <div key={product.name} className="flex justify-between gap-3 rounded-[1rem] bg-rose-50/60 px-3 py-2">
                        <span className="min-w-0 font-semibold">{formatNumber(product.quantity)} x {product.name}</span>
                        <span className="shrink-0 font-black text-fuchsia-700">{formatCurrency(product.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-rose-700/80">No hay productos vendidos en este periodo.</p>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDailyReportOpen(false);
                  setDailyReportPaperSize("56mm");
                  setSalesReportPeriod("daily");
                  setIncludeRealMoneyStats(false);
                }}
                className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePrintDailyReport}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
              >
                <PrintIcon />
                Imprimir cierre
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Ventas</p>
                <h3 className="mt-1 text-xl font-bold text-rose-950">Registrar pago</h3>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar pago"
              >
                <XIcon />
              </button>
            </div>

            <div className="mt-5 rounded-[1.25rem] bg-rose-50/60 p-4 text-sm text-rose-800">
              <div className="flex justify-between gap-3">
                <span>Total venta</span>
                <span className="font-black text-fuchsia-700">{formatCurrency(getSaleNetTotal(paymentSale))}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-rose-500">{paymentSale.client || "Sin cliente"}</p>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => handleDirectPayment("efectivo")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500 bg-rose-500 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:border-rose-800 hover:bg-rose-800"
              >
                <PaymentIcon />
                Efectivo
              </button>
              <button
                type="button"
                onClick={() => handleDirectPayment("transferencia")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-fuchsia-600 bg-fuchsia-600 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:border-fuchsia-900 hover:bg-fuchsia-900"
              >
                <PaymentIcon />
                Debito / transferencia
              </button>
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-rose-100 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Mixto</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Efectivo</span>
                  <input
                    value={mixedCashAmount}
                    onChange={(event) => handleMixedCashChange(event.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                    placeholder="0"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Debito / transferencia</span>
                  <input
                    value={mixedTransferAmount}
                    onChange={(event) => handleMixedTransferChange(event.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                    placeholder="0"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={handleMixedPayment}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-stone-700"
              >
                <PaymentIcon />
                Guardar mixto
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Ventas</p>
                <h3 className="mt-1 text-xl font-bold text-rose-950">Editar venta</h3>
              </div>
              <button
                type="button"
                onClick={closeEditSale}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar edicion de venta"
              >
                <XIcon />
              </button>
            </div>

            <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-auto pr-1">
              <div className="rounded-[1.25rem] bg-rose-50/60 p-4">
                <p className="text-sm font-bold text-rose-950">{formatCurrency(getSaleNetTotal(editingSale))}</p>
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  {formatShortDate(editingSale.date)}
                  {getSaleDeliveryFee(editingSale) > 0 ? ` · Delivery ${formatCurrency(getSaleDeliveryFee(editingSale))}` : ""}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_220px]">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Nombre pedido</span>
                  <input
                    value={saleEditForm.client}
                    onChange={(event) => setSaleEditForm((current) => ({ ...current, client: event.target.value }))}
                    className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                    placeholder="Opcional"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Hora entrega</span>
                  <input
                    value={saleEditForm.fulfillmentTime}
                    onChange={(event) => setSaleEditForm((current) => ({ ...current, fulfillmentTime: event.target.value }))}
                    className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                    placeholder="20:00"
                  />
                </label>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Entrega</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                    {[
                      { value: "retiro", label: "Retiro" },
                      { value: "delivery", label: "Delivery" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSaleEditDeliveryType(option.value as DeliveryType)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                          saleEditForm.deliveryType === option.value ? "bg-fuchsia-600 text-white" : "text-rose-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {saleEditForm.deliveryType === "delivery" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Direccion delivery</span>
                      <input
                        value={saleEditForm.deliveryAddress}
                        onChange={(event) => setSaleEditForm((current) => ({ ...current, deliveryAddress: event.target.value }))}
                        className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                        placeholder="Calle, numero, referencia"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Valor delivery</span>
                      <input
                        value={saleEditForm.deliveryFee}
                        onChange={(event) =>
                          setSaleEditForm((current) => ({ ...current, deliveryFee: event.target.value.replace(/\D/g, "") }))
                        }
                        inputMode="numeric"
                        className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Pago delivery</p>
                    <div className="mt-2 grid gap-2 rounded-[1rem] bg-rose-50 p-1 sm:grid-cols-4">
                      {Object.entries(deliveryPaymentMethodLabels).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setSaleEditForm((current) => ({ ...current, deliveryPaymentMethod: value as DeliveryPaymentMethod }))
                          }
                          className={`rounded-[0.8rem] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                            saleEditForm.deliveryPaymentMethod === value ? "bg-fuchsia-600 text-white" : "text-rose-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Detalle / nota</span>
                <textarea
                  rows={4}
                  value={saleEditForm.detail}
                  onChange={(event) => setSaleEditForm((current) => ({ ...current, detail: event.target.value }))}
                  className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                  placeholder="Descuento, regalo, canje, consumo trabajador..."
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-rose-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditSale}
                className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSaleEdit}
                className="rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDailyReportDate(getDateInputValue());
            setSalesReportPeriod("daily");
            setDailyReportPaperSize("56mm");
            setIncludeRealMoneyStats(false);
            setIsDailyReportOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-5 py-3 text-sm font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-white"
        >
          <PrintIcon />
          Imprimir cierre
        </button>
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
                    <th className="pb-3 pr-4 font-semibold">Venta</th>
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
                            {sale.deliveryType === "delivery" && sale.deliveryPaymentMethod ? (
                              <p className="mt-1 text-xs text-rose-700/80">
                                Pago delivery: {deliveryPaymentMethodLabels[sale.deliveryPaymentMethod]}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4">
                            <p className="font-bold text-fuchsia-700">{formatCurrency(getSaleNetTotal(sale))}</p>
                            {getSaleDeliveryFee(sale) > 0 ? (
                              <p className="mt-1 text-xs font-semibold text-rose-500">Delivery: {formatCurrency(getSaleDeliveryFee(sale))}</p>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4">
                            {sale.status === "pendiente" ? (
                              <div onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal(sale)}
                                  className="inline-flex items-center gap-1 rounded-full border border-fuchsia-600 bg-fuchsia-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:border-fuchsia-900 hover:bg-fuchsia-900 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                                >
                                  <PaymentIcon />
                                  Pago
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                                  sale.status === "efectivo"
                                    ? "bg-rose-50 text-rose-600"
                                    : sale.status === "mixto"
                                      ? "bg-stone-100 text-stone-700"
                                      : "bg-fuchsia-50 text-fuchsia-700"
                                }`}
                              >
                                {saleStatusLabels[sale.status]}
                              </span>
                            )}
                            {sale.status === "mixto" ? (
                              <p className="mt-2 text-xs font-semibold text-rose-700/80">
                                Efectivo {formatCurrency(sale.cashAmount ?? 0)} · Debito {formatCurrency(sale.transferAmount ?? 0)}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => void copySaleLocation(sale)}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300 ${
                                  copiedSaleId === sale.id
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-white text-rose-600 hover:border-fuchsia-700 hover:bg-fuchsia-700 hover:text-white hover:shadow-md"
                                }`}
                                aria-label="Copiar nombre y lugar"
                                title="Copiar nombre y lugar"
                              >
                                <CopyIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => openReprintReceipt(sale)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm transition hover:border-stone-800 hover:bg-stone-800 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                                aria-label="Reimprimir venta"
                              >
                                <PrintIcon />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setActionsSaleId((current) => (current === sale.id ? null : sale.id))}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 shadow-sm transition hover:border-fuchsia-700 hover:bg-fuchsia-700 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                                  aria-label="Abrir ajustes de venta"
                                >
                                  <DotsIcon />
                                </button>

                                {actionsSaleId === sale.id ? (
                                  <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-[1rem] border border-rose-100 bg-white p-2 text-left shadow-[0_18px_45px_rgba(28,25,23,0.16)]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionsSaleId(null);
                                        openEditSale(sale);
                                      }}
                                      className="block w-full rounded-[0.8rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-700 transition hover:bg-fuchsia-50"
                                    >
                                      Editar venta
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openPaymentModal(sale)}
                                      className="block w-full rounded-[0.8rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:bg-stone-100"
                                    >
                                      Editar forma de pago
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionsSaleId(null);
                                        onDelete(sale.id);
                                      }}
                                      className="block w-full rounded-[0.8rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-rose-600 transition hover:bg-rose-50"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                ) : null}
                              </div>
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
                                    {item.drink || shouldShowSauce(item) || item.removedIngredients?.length ? (
                                      <p className="mt-2 text-xs leading-5 text-rose-700/80">
                                        {[
                                          item.drink ? `Bebida: ${item.drink}` : "",
                                          shouldShowSauce(item) ? `Salsa: ${item.sauce}` : "",
                                          item.removedIngredients?.length ? `Sin: ${item.removedIngredients.join(", ")}` : "",
                                          ...getFamilyBurgerNotes(item),
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
