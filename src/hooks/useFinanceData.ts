import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  initialInventoryForm,
  initialPurchaseForm,
  initialSaleForm,
  type InventoryFormState,
  type PurchaseFormState,
  type SaleFormState,
  type ToastState,
} from "../constants/app";
import { productCatalog } from "../data/product-catalog";
import { familyComboBurgers, orderMenuItems } from "../data/order-menu";
import {
  loadIngredientStore,
  registerSale,
  saveIngredientStore,
} from "../data/ingredientStore";
import { getCurrentDate, getLastDays } from "../lib/date";
import { addRecord, clearAllRecords, deleteRecord, getAllRecords } from "../lib/db";
import { downloadFile, inventoryRowsToCsv, purchaseRowsToCsv, salesRowsToCsv } from "../lib/format";
import { createId } from "../lib/id";
import { getSaleNetTotal } from "../lib/sales";
import type {
  BackupPayload,
  DeliveryPaymentMethod,
  DeliveryType,
  InventoryItem,
  MovementCategory,
  MovementPaymentMethod,
  MovementType,
  Purchase,
  PurchaseEntryType,
  PurchaseItemType,
  Sale,
  SaleFromOrderInput,
  SaleOrderItem,
  SaleStatus,
  StockControlMode,
  StockMovement,
  StoreName,
  WeeklySalesStats,
} from "../types";
import type { InventorySaleInputItem } from "../types/inventory";

const getNumericValue = (value: string) => Number(value || 0);
const initialBalances = {
  cash: 51640,
  debit: 96292,
  controlStartDate: "2026-05-19",
};

const isWithinControlPeriod = (date: string) => date >= initialBalances.controlStartDate;

const isDebitLikePayment = (paymentMethod?: MovementPaymentMethod) =>
  paymentMethod === "debito" || paymentMethod === "transferencia" || paymentMethod === "credito" || paymentMethod === "otro";
const normalizeCsvHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parsePurchaseDate = (raw: string) => {
  const value = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dateParts = value.split(/[/-]/).map((part) => part.trim());

  if (dateParts.length !== 2 && dateParts.length !== 3) {
    return null;
  }

  const [day, month, yearPart = getCurrentDate().slice(0, 4)] = dateParts;
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const parseSaleDate = (raw: string) => {
  const value = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return parsePurchaseDate(value);
};

const createSaleCreatedAt = (date: string) => {
  const parsedDate = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
};

const getLocalDateFromIso = (value?: string) => {
  if (!value) {
    return getCurrentDate();
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return getCurrentDate();
  }

  const year = parsedDate.getFullYear();
  const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsedDate.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseCurrencyValue = (value: string) => {
  const normalized = value.replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : NaN;
};

const getOptionalCurrencyValue = (value: string) => {
  const parsed = parseCurrencyValue(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDeliveryType = (raw: string): DeliveryType => {
  const delivery = normalizeCsvHeader(raw);
  return delivery.includes("DELIVERY") ? "delivery" : "retiro";
};

const parseDeliveryPaymentMethod = (raw: string): DeliveryPaymentMethod | undefined => {
  const paymentMethod = normalizeCsvHeader(raw);
  if (!paymentMethod) return undefined;
  if (paymentMethod.includes("CLIENTE") && paymentMethod.includes("EFECTIVO")) return "cliente_efectivo";
  if (paymentMethod.includes("NOSOTROS")) return "nosotros";
  if (paymentMethod.includes("DEBITO") || paymentMethod.includes("TARJETA")) return "debito";
  if (paymentMethod.includes("EFECTIVO")) return "efectivo";
  return undefined;
};

const parseMovementPaymentMethod = (raw: string): MovementPaymentMethod => {
  const paymentMethod = normalizeCsvHeader(raw);
  if (paymentMethod.includes("EFECTIVO")) return "efectivo";
  if (paymentMethod.includes("DEBITO") || paymentMethod.includes("TARJETA")) return "debito";
  if (paymentMethod.includes("TRANSFER")) return "transferencia";
  if (paymentMethod.includes("CREDITO")) return "credito";
  return "otro";
};

const resolveMovementType = (rawCategory: string): MovementType => {
  const category = normalizeCsvHeader(rawCategory);
  if (category.includes("PERSONAL")) return "personal";
  if (category.includes("INVERSION")) return "inversion";
  if (category.includes("GASTO") || category.includes("OPERATIVO")) return "operativo";
  return "compra";
};

const resolveMovementCategory = (detail: string, movementType: MovementType): MovementCategory => {
  const normalizedDetail = normalizeCsvHeader(detail);

  if (movementType === "personal") return "personal";
  if (movementType === "inversion") return "inversion";
  if (movementType === "operativo") {
    if (normalizedDetail.includes("GAS")) return "gas";
    if (normalizedDetail.includes("TRANSPORTE") || normalizedDetail.includes("UBER")) return "transporte";
    if (normalizedDetail.includes("TELSUR") || normalizedDetail.includes("INTERNET")) return "internet";
    if (normalizedDetail.includes("FRONTEL") || normalizedDetail.includes("LUZ")) return "luz";
    if (normalizedDetail.includes("AGUA")) return "agua";
    return "transporte";
  }

  if (normalizedDetail.includes("BEBIDA") || normalizedDetail.includes("COCA") || normalizedDetail.includes("FANTA") || normalizedDetail.includes("SPRITE")) {
    return "bebidas";
  }

  if (
    normalizedDetail.includes("ENVASE") ||
    normalizedDetail.includes("POTE") ||
    normalizedDetail.includes("VASO") ||
    normalizedDetail.includes("BOLSA") ||
    normalizedDetail.includes("ROLLO") ||
    normalizedDetail.includes("ALUMINIO")
  ) {
    return "envases";
  }

  if (
    normalizedDetail.includes("NOVA") ||
    normalizedDetail.includes("CONFORT") ||
    normalizedDetail.includes("LIMPIEZA")
  ) {
    return "limpieza";
  }

  if (
    normalizedDetail.includes("ACEITE") ||
    normalizedDetail.includes("BBQ") ||
    normalizedDetail.includes("SALSA") ||
    normalizedDetail.includes("MAYONESA") ||
    normalizedDetail.includes("MOSTAZA")
  ) {
    return "insumos_cocina";
  }

  return "materia_prima";
};

const parseExportedOrderItems = (orderText: string, fallbackTotal: number): SaleOrderItem[] | undefined => {
  const rawItems = orderText
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawItems.length === 0) {
    return undefined;
  }

  const parsedItems = rawItems.map((rawItem) => {
    const match = rawItem.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(.+)$/i);
    const quantity = match ? Number.parseFloat(match[1].replace(",", ".")) || 1 : 1;
    const itemText = match ? match[2].trim() : rawItem;
    const notesMatch = itemText.match(/^(.*?)\s*\((.*)\)$/);
    const name = (notesMatch ? notesMatch[1] : itemText).trim();
    const notes = (notesMatch?.[2] ?? "")
      .split("·")
      .map((note) => note.trim())
      .filter(Boolean);
    const drink = notes.find((note) => normalizeCsvHeader(note).startsWith("BEBIDA:"))?.replace(/^Bebida:\s*/i, "");
    const sauce = notes.find((note) => normalizeCsvHeader(note).startsWith("SALSA:"))?.replace(/^Salsa:\s*/i, "");
    const removedIngredients = notes
      .find((note) => normalizeCsvHeader(note).startsWith("SIN:"))
      ?.replace(/^Sin:\s*/i, "")
      .split(",")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);
    const familyBurgers = notes
      .map((note) => {
        const familyBurgerMatch = note.match(/^(.+?):\s*sin\s+(.+)$/i);

        if (!familyBurgerMatch) {
          return null;
        }

        return {
          label: familyBurgerMatch[1].trim(),
          name: familyBurgerMatch[1].trim().replace(/\s+\d+$/, ""),
          removedIngredients: familyBurgerMatch[2]
            .split(",")
            .map((ingredient) => ingredient.trim())
            .filter(Boolean),
        };
      })
      .filter((burger): burger is NonNullable<typeof burger> => Boolean(burger));

    return {
      name,
      quantity,
      unitPrice: 0,
      total: 0,
      drink,
      sauce,
      removedIngredients,
      familyBurgers: familyBurgers.length > 0 ? familyBurgers : undefined,
    } satisfies SaleOrderItem;
  });

  const totalQuantity = parsedItems.reduce((total, item) => total + item.quantity, 0) || 1;

  return parsedItems.map((item) => {
    const itemTotal = Math.round((fallbackTotal * item.quantity) / totalQuantity);
    return {
      ...item,
      unitPrice: item.quantity > 0 ? Math.round(itemTotal / item.quantity) : itemTotal,
      total: itemTotal,
    };
  });
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const normalizePurchase = (purchase: Purchase): Purchase => ({
  ...purchase,
  entryType: purchase.entryType ?? "expense",
  itemType: purchase.itemType ?? "operating_expense",
  affectsInventory: purchase.affectsInventory ?? false,
  stockControl: purchase.stockControl ?? "simple",
  internalSupplyMode: purchase.internalSupplyMode ?? "expense",
  movementType:
    purchase.movementType ??
    (purchase.entryType === "investment" ? "inversion" : purchase.affectsInventory ? "compra" : "operativo"),
  category:
    purchase.category ??
    (purchase.entryType === "investment" ? "inversion" : purchase.affectsInventory ? "materia_prima" : "gas"),
  unit: purchase.unit ?? "unidad",
  amount: purchase.amount ?? purchase.total,
  paymentMethod: purchase.paymentMethod ?? "otro",
});

const purchaseAffectsInventory = (purchase: Pick<PurchaseFormState, "type">) => purchase.type === "compra";

const resolveStockControl = (itemType: PurchaseItemType, requestedControl: StockControlMode) =>
  itemType === "rotating_input" ? requestedControl : "simple";

const getInventoryKey = (name: string, itemType?: PurchaseItemType, stockControl?: StockControlMode) =>
  `${normalizeText(name)}:${itemType ?? "sale_inventory"}:${stockControl ?? "simple"}`;

const catalogIndex = new Map(
  productCatalog.map((item) => [
    normalizeText(item.name),
    {
      ...item,
      normalizedName: normalizeText(item.name),
    },
  ]),
);

const catalogMatchers = [...catalogIndex.values()].sort((a, b) => b.normalizedName.length - a.normalizedName.length);
const orderMenuByName = new Map(orderMenuItems.map((item) => [normalizeText(item.name), item]));
const saleStatsProductMatchers = [...orderMenuByName.values()]
  .map((item) => ({ ...item, normalizedName: normalizeText(item.name) }))
  .sort((a, b) => b.normalizedName.length - a.normalizedName.length);

const parseLocalDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatWeekLabel = (start: Date, end: Date) =>
  `${start.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
  })}`;

const getServiceWeekStart = (date: string) => {
  const parsedDate = parseLocalDate(date);
  const day = parsedDate.getDay();
  const daysSinceThursday = (day + 3) % 7;
  parsedDate.setDate(parsedDate.getDate() - daysSinceThursday);
  return parsedDate;
};

const resolveSaleStatsProductName = (sale: Sale) => {
  const explicit = sale.productName ? normalizeText(sale.productName) : "";
  if (explicit && orderMenuByName.has(explicit)) {
    return orderMenuByName.get(explicit)?.name ?? null;
  }

  const detail = normalizeText(sale.detail);
  const match = saleStatsProductMatchers.find((item) => detail.includes(item.normalizedName));
  return match?.name ?? null;
};

const addCount = (map: Map<string, number>, name: string, quantity: number) => {
  if (quantity <= 0) {
    return;
  }

  map.set(name, (map.get(name) ?? 0) + quantity);
};

const getNuggetUnits = (name: string) => {
  const match = name.match(/x(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 1;
};

const getFamilyComboBurgerCount = (item: SaleOrderItem) => item.familyBurgers?.length ?? familyComboBurgers[item.name]?.length ?? 0;

const addItemToWeeklyStats = (
  stats: WeeklySalesStats,
  productBreakdown: Map<string, number>,
  drinkBreakdown: Map<string, number>,
  sauceBreakdown: Map<string, number>,
  item: SaleOrderItem,
) => {
  const quantity = item.quantity > 0 ? item.quantity : 1;
  const menuItem = orderMenuByName.get(normalizeText(item.name));

  addCount(productBreakdown, item.name, quantity);

  if (item.drink) {
    stats.drinks += quantity;
    addCount(drinkBreakdown, item.drink, quantity);
  }

  if (item.sauce) {
    stats.sauces += quantity;
    addCount(sauceBreakdown, item.sauce, quantity);
  }

  if (menuItem?.category === "burgers") {
    stats.burgers += quantity;
    return;
  }

  if (menuItem?.category === "individual-combos") {
    const familyBurgerCount = getFamilyComboBurgerCount(item);
    stats.burgers += familyBurgerCount > 0 ? familyBurgerCount * quantity : quantity;
    return;
  }

  if (menuItem?.category === "family-combos") {
    stats.burgers += getFamilyComboBurgerCount(item) * quantity;
    return;
  }

  if (menuItem?.category === "offers") {
    const familyBurgerCount = getFamilyComboBurgerCount(item);
    stats.burgers += familyBurgerCount > 0 ? familyBurgerCount * quantity : quantity;
    return;
  }

  if (menuItem?.category === "papero-combo") {
    stats.burgers += quantity;
    stats.fries += quantity;
    return;
  }

  if (menuItem?.category === "sides") {
    if (normalizeText(item.name).includes("PAP")) {
      stats.fries += quantity;
    } else if (normalizeText(item.name).includes("BEBIDA")) {
      if (!item.drink) {
        stats.drinks += quantity;
        addCount(drinkBreakdown, item.name, quantity);
      }
    } else if (normalizeText(item.name).includes("NUGGET")) {
      stats.nuggets += getNuggetUnits(item.name) * quantity;
    } else {
      stats.other += quantity;
    }
    return;
  }

  if (menuItem?.category === "sauces") {
    stats.sauces += quantity;
    addCount(sauceBreakdown, item.name, quantity);
    return;
  }

  stats.other += quantity;
};

const resolveProductName = (sale: Sale) => {
  const explicit = sale.productName ? normalizeText(sale.productName) : "";
  if (explicit && catalogIndex.has(explicit)) {
    return catalogIndex.get(explicit)?.name ?? null;
  }

  const detail = normalizeText(sale.detail);
  const match = catalogMatchers.find((item) => detail.includes(item.normalizedName));
  return match?.name ?? null;
};

const inferSaleQuantity = (sale: Sale, price: number) => {
  if (sale.quantity && sale.quantity > 0) {
    return sale.quantity;
  }

  if (price <= 0) {
    return 0;
  }

  const saleTotal = getSaleNetTotal(sale);
  const estimate = Math.round(saleTotal / price);
  if (estimate <= 0) {
    return 0;
  }

  const difference = Math.abs(saleTotal - estimate * price);
  return difference <= Math.max(250, price * 0.12) ? estimate : 0;
};

const mapSaleOrderItemsToInventoryItems = (items: SaleOrderItem[]): InventorySaleInputItem[] =>
  items.map((item) => ({
    productName: item.name,
    quantity: item.quantity,
    drink: item.drink,
    sauce: item.sauce,
    removedIngredients: item.removedIngredients,
  }));

export function useFinanceData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(initialPurchaseForm);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState<SaleFormState>(initialSaleForm);
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(initialInventoryForm);

  useEffect(() => {
    const load = async () => {
      try {
        const [purchaseRows, saleRows, inventoryRows, stockMovementRows] = await Promise.all([
          getAllRecords("purchases"),
          getAllRecords("sales"),
          getAllRecords("inventory"),
          getAllRecords("stockMovements"),
        ]);

        setPurchases(purchaseRows.map(normalizePurchase));
        setSales(saleRows);
        setInventory(inventoryRows);
        setStockMovements(stockMovementRows);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la informacion.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const saveFeedback = (tone: ToastState["tone"], message: string) => {
    setToast({ tone, message });
  };

  const purchasePreviewTotal = getNumericValue(purchaseForm.amount);
  const inventoryPreviewTotal = getNumericValue(inventoryForm.quantity) * getNumericValue(inventoryForm.unitPrice);

  const totals = useMemo(() => {
    const controlledSales = sales.filter((item) => isWithinControlPeriod(item.date));
    const controlledPurchases = purchases.filter((item) => isWithinControlPeriod(item.date));
    const allTimeInvestments = purchases.filter((item) => item.movementType === "inversion" || item.entryType === "investment");
    const allTimeExpenseMovements = purchases.filter((item) => item.movementType !== "inversion" && item.entryType !== "investment");
    const allTimeIncome = sales.reduce((sum, item) => sum + item.total, 0);
    const allTimeCollectedIncome = sales.filter((item) => item.status !== "pendiente").reduce((sum, item) => sum + item.total, 0);
    const allTimePendingIncome = sales.filter((item) => item.status === "pendiente").reduce((sum, item) => sum + item.total, 0);
    const allTimeExpenses = allTimeExpenseMovements.reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const allTimeBusinessPurchases = allTimeExpenseMovements
      .filter((item) => item.movementType === "compra" || item.affectsInventory)
      .reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const allTimeOperatingExpenses = allTimeExpenseMovements
      .filter((item) => item.movementType === "operativo")
      .reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const allTimeInitialInvestment = allTimeInvestments.reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const allTimeUtility = allTimeIncome - allTimeExpenses;
    const allTimeSimpleProfit = allTimeCollectedIncome - allTimeBusinessPurchases - allTimeOperatingExpenses;
    const income = controlledSales.reduce((sum, item) => sum + item.total, 0);
    const collectedIncome = controlledSales.filter((item) => item.status !== "pendiente").reduce((sum, item) => sum + item.total, 0);
    const cashIncome = controlledSales.reduce((sum, item) => {
      if (item.status === "efectivo") return sum + item.total;
      if (item.status === "mixto") return sum + (item.cashAmount ?? 0);
      return sum;
    }, 0);
    const transferIncome = controlledSales.reduce((sum, item) => {
      if (item.status === "transferencia") return sum + item.total;
      if (item.status === "mixto") return sum + (item.transferAmount ?? 0);
      return sum;
    }, 0);
    const pendingIncome = controlledSales.filter((item) => item.status === "pendiente").reduce((sum, item) => sum + item.total, 0);
    const salesCount = controlledSales.length;
    const investments = controlledPurchases.filter((item) => item.movementType === "inversion" || item.entryType === "investment");
    const expenseMovements = controlledPurchases.filter((item) => item.movementType !== "inversion" && item.entryType !== "investment");
    const expenses = expenseMovements.reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const purchasesCount = expenseMovements.length;
    const inventoryPurchaseCost = expenseMovements
      .filter((item) => item.affectsInventory)
      .reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const nonInventoryPurchaseCost = expenseMovements
      .filter((item) => !item.affectsInventory)
      .reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const initialInvestment = investments.reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const operatingExpenses = expenses;
    const investmentCount = investments.length;
    const expenseCount = expenseMovements.length;
    const cashExpenses = expenseMovements
      .filter((item) => item.paymentMethod === "efectivo")
      .reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const debitExpenses = expenseMovements
      .filter((item) => isDebitLikePayment(item.paymentMethod))
      .reduce((sum, item) => sum + (item.amount ?? item.total), 0);
    const availableCash = initialBalances.cash + cashIncome - cashExpenses;
    const availableDebit = initialBalances.debit + transferIncome - debitExpenses;
    const availableTotal = availableCash + availableDebit;

    const inventoryValue = inventory.reduce((sum, item) => sum + item.total, 0);

    const utilityTotal = income - operatingExpenses;
    const profitability = income > 0 ? utilityTotal / income : 0;
    const marginOnSpend = operatingExpenses > 0 ? utilityTotal / operatingExpenses : 0;
    const roi = initialInvestment > 0 ? utilityTotal / initialInvestment : 0;

    const activityDates = new Set([
      ...controlledSales.map((item) => item.date),
      ...expenseMovements.map((item) => item.date),
    ]);
    const activeDays = Math.max(activityDates.size, 1);

    const productMetricsMap = new Map<
      string,
      {
        name: string;
        unitsSold: number;
        cost: number;
        price: number;
        marginUnit: number;
        marginPercent: number;
        absoluteProfit: number;
      }
    >();

    const addProductMetric = (productName: string | null, quantity: number) => {
      if (!productName || quantity <= 0) {
        return;
      }

      const product = catalogIndex.get(normalizeText(productName));
      if (!product) {
        return;
      }

      const current = productMetricsMap.get(product.name) ?? {
        name: product.name,
        unitsSold: 0,
        cost: product.cost,
        price: product.price,
        marginUnit: product.price - product.cost,
        marginPercent: product.price > 0 ? (product.price - product.cost) / product.price : 0,
        absoluteProfit: 0,
      };

      current.unitsSold += quantity;
      current.absoluteProfit += (product.price - product.cost) * quantity;
      productMetricsMap.set(product.name, current);
    };

    for (const sale of sales) {
      if (sale.orderItems && sale.orderItems.length > 0) {
        for (const item of sale.orderItems) {
          addProductMetric(item.name, item.quantity);
        }
        continue;
      }

      const productName = resolveProductName(sale);
      const product = productName ? catalogIndex.get(normalizeText(productName)) : null;
      addProductMetric(productName, product ? inferSaleQuantity(sale, product.price) : 0);
    }

    const productMetrics = [...productMetricsMap.values()];
    const topProductsByMargin = [...productMetrics]
      .sort((a, b) => b.marginPercent - a.marginPercent || b.absoluteProfit - a.absoluteProfit)
      .slice(0, 5);
    const topProductsByProfit = [...productMetrics]
      .sort((a, b) => b.absoluteProfit - a.absoluteProfit || b.marginPercent - a.marginPercent)
      .slice(0, 5);
    const weeklyStatsMap = new Map<string, WeeklySalesStats>();
    const weeklyProductBreakdowns = new Map<string, Map<string, number>>();
    const weeklyDrinkBreakdowns = new Map<string, Map<string, number>>();
    const weeklySauceBreakdowns = new Map<string, Map<string, number>>();

    const ensureWeeklyStats = (sale: Sale) => {
      const weekStart = getServiceWeekStart(sale.date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 3);
      const weekKey = formatLocalDate(weekStart);
      const current = weeklyStatsMap.get(weekKey);

      if (current) {
        return current;
      }

      const nextStats: WeeklySalesStats = {
        weekKey,
        label: `Jue-Dom ${formatWeekLabel(weekStart, weekEnd)}`,
        salesCount: 0,
        income: 0,
        burgers: 0,
        fries: 0,
        drinks: 0,
        nuggets: 0,
        sauces: 0,
        other: 0,
        products: [],
        drinksBreakdown: [],
        saucesBreakdown: [],
      };

      weeklyStatsMap.set(weekKey, nextStats);
      weeklyProductBreakdowns.set(weekKey, new Map());
      weeklyDrinkBreakdowns.set(weekKey, new Map());
      weeklySauceBreakdowns.set(weekKey, new Map());
      return nextStats;
    };

    for (const sale of sales) {
      const weeklyStats = ensureWeeklyStats(sale);
      const productBreakdown = weeklyProductBreakdowns.get(weeklyStats.weekKey) ?? new Map();
      const drinkBreakdown = weeklyDrinkBreakdowns.get(weeklyStats.weekKey) ?? new Map();
      const sauceBreakdown = weeklySauceBreakdowns.get(weeklyStats.weekKey) ?? new Map();

      weeklyStats.salesCount += 1;
      weeklyStats.income += getSaleNetTotal(sale);

      if (sale.orderItems && sale.orderItems.length > 0) {
        for (const item of sale.orderItems) {
          addItemToWeeklyStats(weeklyStats, productBreakdown, drinkBreakdown, sauceBreakdown, item);
        }
        continue;
      }

      const productName = resolveSaleStatsProductName(sale);
      if (!productName) {
        weeklyStats.other += sale.quantity || 1;
        continue;
      }

      const product = catalogIndex.get(normalizeText(productName));
      const quantity = sale.quantity || (product ? inferSaleQuantity(sale, product.price) : 1) || 1;
      addItemToWeeklyStats(weeklyStats, productBreakdown, drinkBreakdown, sauceBreakdown, {
        name: productName,
        quantity,
        unitPrice: quantity > 0 ? getSaleNetTotal(sale) / quantity : getSaleNetTotal(sale),
        total: getSaleNetTotal(sale),
        familyBurgers: familyComboBurgers[productName],
      });
    }

    const weeklyStats = [...weeklyStatsMap.values()]
      .map((item) => {
        const products = [...(weeklyProductBreakdowns.get(item.weekKey)?.entries() ?? [])]
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "es"));
        const drinksBreakdown = [...(weeklyDrinkBreakdowns.get(item.weekKey)?.entries() ?? [])]
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "es"));
        const saucesBreakdown = [...(weeklySauceBreakdowns.get(item.weekKey)?.entries() ?? [])]
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "es"));

        return {
          ...item,
          products,
          drinksBreakdown,
          saucesBreakdown,
        };
      })
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    return {
      income,
      collectedIncome,
      cashIncome,
      transferIncome,
      pendingIncome,
      allTimeIncome,
      allTimeCollectedIncome,
      allTimePendingIncome,
      allTimeExpenses,
      allTimeBusinessPurchases,
      allTimeOperatingExpenses,
      allTimeInitialInvestment,
      allTimeUtility,
      allTimeSimpleProfit,
      allTimeSalesCount: sales.length,
      allTimeMovementsCount: purchases.length,
      cashExpenses,
      debitExpenses,
      availableCash,
      availableDebit,
      availableTotal,
      initialCashBalance: initialBalances.cash,
      initialDebitBalance: initialBalances.debit,
      controlStartDate: initialBalances.controlStartDate,
      salesCount,
      expenses,
      purchasesCount,
      initialInvestment,
      operatingExpenses,
      investmentCount,
      expenseCount,
      inventoryValue,
      inventoryPurchaseCost,
      nonInventoryPurchaseCost,
      utilityTotal,
      profitability,
      marginOnSpend,
      roi,
      averageDailyIncome: income / activeDays,
      averageDailyExpense: operatingExpenses / activeDays,
      averageDailyUtility: utilityTotal / activeDays,
      activeDays,
      productMetrics,
      topProductsByMargin,
      topProductsByProfit,
      weeklyStats,
      net: availableTotal,
      expectedCash: availableTotal,
    };
  }, [inventory, purchases, sales]);

  const chartData = useMemo(() => {
    const lastDays = getLastDays(7);

    return lastDays.map((date) => ({
      date,
      income: sales.filter((item) => item.date === date).reduce((sum, item) => sum + item.total, 0),
      expense: purchases
        .filter((item) => item.date === date && item.movementType !== "inversion" && item.entryType !== "investment")
        .reduce((sum, item) => sum + (item.amount ?? item.total), 0),
    }));
  }, [purchases, sales]);

  const handleDelete = async (storeName: StoreName, id: string, skipConfirmation = false) => {
    const confirmed = skipConfirmation || window.confirm("Se eliminara este registro del dispositivo. Quieres continuar?");
    if (!confirmed) {
      return;
    }

    try {
      const purchaseToDelete = storeName === "purchases" ? purchases.find((item) => item.id === id) : undefined;
      await deleteRecord(storeName, id);

      if (purchaseToDelete?.stockMovementId) {
        await deleteRecord("stockMovements", purchaseToDelete.stockMovementId);
      }

      if (purchaseToDelete?.affectsInventory && purchaseToDelete.inventoryItemId) {
        const inventoryItem = inventory.find((item) => item.id === purchaseToDelete.inventoryItemId);

        if (inventoryItem) {
          const nextQuantity = inventoryItem.quantity - purchaseToDelete.quantity;
          const nextTotal = inventoryItem.total - purchaseToDelete.total;

          if (nextQuantity <= 0 || nextTotal <= 0) {
            await deleteRecord("inventory", inventoryItem.id);
            setInventory((current) => current.filter((item) => item.id !== inventoryItem.id));
          } else {
            const updatedInventoryItem: InventoryItem = {
              ...inventoryItem,
              quantity: nextQuantity,
              total: nextTotal,
              unitPrice: nextTotal / nextQuantity,
              updatedAt: new Date().toISOString(),
            };
            await addRecord("inventory", updatedInventoryItem);
            setInventory((current) => current.map((item) => (item.id === updatedInventoryItem.id ? updatedInventoryItem : item)));
          }
        }
      }

      if (storeName === "purchases") {
        setPurchases((current) => current.filter((item) => item.id !== id));
        if (purchaseToDelete?.stockMovementId) {
          setStockMovements((current) => current.filter((item) => item.id !== purchaseToDelete.stockMovementId));
        }
      }

      if (storeName === "sales") {
        setSales((current) => current.filter((item) => item.id !== id));
      }

      if (storeName === "inventory") {
        setInventory((current) => current.filter((item) => item.id !== id));
      }

      if (storeName === "stockMovements") {
        setStockMovements((current) => current.filter((item) => item.id !== id));
      }

      saveFeedback("success", "Registro eliminado.");
    } catch (deleteError) {
      saveFeedback("error", deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el registro.");
    }
  };

  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      "Se borraran todas las compras, ventas e inventario guardados en este dispositivo. Quieres continuar?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await clearAllRecords();
      setPurchases([]);
      setSales([]);
      setInventory([]);
      setStockMovements([]);
      setPurchaseForm(initialPurchaseForm());
      setSaleForm(initialSaleForm());
      setInventoryForm(initialInventoryForm());
      setError(null);
      saveFeedback("success", "Todos los datos fueron eliminados.");
    } catch (clearError) {
      saveFeedback(
        "error",
        clearError instanceof Error ? clearError.message : "No fue posible borrar todos los datos de la aplicacion.",
      );
    }
  };

  const handlePurchaseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = getNumericValue(purchaseForm.quantity);
    const total = getNumericValue(purchaseForm.amount);
    const unitPrice = quantity > 0 ? Math.round(total / quantity) : total;
    const affectsInventory = purchaseAffectsInventory(purchaseForm);
    const itemType: PurchaseItemType = affectsInventory ? "sale_inventory" : "operating_expense";
    const stockControl = resolveStockControl(itemType, "simple");
    const entryType: PurchaseEntryType = purchaseForm.type === "inversion" ? "investment" : "expense";

    if (!purchaseForm.detail.trim() || quantity <= 0 || total <= 0) {
      saveFeedback("error", "Completa detalle, cantidad y monto.");
      return;
    }

    const createdAt = new Date().toISOString();
    const existingPurchase = editingPurchaseId ? purchases.find((purchase) => purchase.id === editingPurchaseId) : undefined;
    const purchaseId = existingPurchase?.id ?? createId();
    const stockMovementId = existingPurchase?.stockMovementId ?? (affectsInventory && !editingPurchaseId ? createId() : undefined);
    const movementDate = purchaseForm.date || getCurrentDate();
    const inventoryKey = getInventoryKey(purchaseForm.detail, itemType, stockControl);
    const existingInventoryItem = affectsInventory
      ? inventory.find((item) => getInventoryKey(item.name, item.itemType, item.stockControl) === inventoryKey)
      : undefined;
    const inventoryItemId = affectsInventory ? existingInventoryItem?.id ?? createId() : undefined;

    const payload: Purchase = {
      id: purchaseId,
      createdAt: existingPurchase?.createdAt ?? createdAt,
      date: movementDate,
      detail: purchaseForm.detail.trim(),
      quantity,
      supplier: purchaseForm.paymentMethod,
      unitPrice,
      total,
      entryType,
      itemType,
      affectsInventory,
      stockControl,
      internalSupplyMode: "expense",
      movementType: purchaseForm.type,
      category: purchaseForm.category,
      unit: purchaseForm.unit.trim() || "unidad",
      amount: total,
      paymentMethod: purchaseForm.paymentMethod,
      inventoryItemId: existingPurchase?.inventoryItemId ?? inventoryItemId,
      stockMovementId,
    };

    if (editingPurchaseId) {
      try {
        await addRecord("purchases", payload);
        setPurchases((current) =>
          [normalizePurchase(payload), ...current.filter((purchase) => purchase.id !== editingPurchaseId)].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        );
        setPurchaseForm(initialPurchaseForm());
        setEditingPurchaseId(null);
        saveFeedback("success", "Movimiento actualizado correctamente.");
      } catch (submitError) {
        saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible actualizar el movimiento.");
      }
      return;
    }

    const inventoryPayload: InventoryItem | null =
      affectsInventory && inventoryItemId
        ? {
            id: inventoryItemId,
            createdAt: existingInventoryItem?.createdAt ?? createdAt,
            date: movementDate,
            name: purchaseForm.detail.trim(),
            quantity: (existingInventoryItem?.quantity ?? 0) + quantity,
            place: purchaseForm.paymentMethod,
            unitPrice,
            total: (existingInventoryItem?.total ?? 0) + total,
            itemType,
            stockControl,
            sourcePurchaseId: purchaseId,
            updatedAt: createdAt,
          }
        : null;

    const stockMovementPayload: StockMovement | null =
      affectsInventory && stockMovementId
        ? {
            id: stockMovementId,
            createdAt,
            date: movementDate,
            itemName: purchaseForm.detail.trim(),
            itemType,
            movementType: "entry",
            quantity,
            unitCost: unitPrice,
            total,
            sourceType: "purchase",
            sourceId: purchaseId,
            supplier: purchaseForm.paymentMethod,
            stockControl,
          }
        : null;

    try {
      await addRecord("purchases", payload);
      if (inventoryPayload) {
        await addRecord("inventory", inventoryPayload);
      }
      if (stockMovementPayload) {
        await addRecord("stockMovements", stockMovementPayload);
      }
      setPurchases((current) => [normalizePurchase(payload), ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (inventoryPayload) {
        setInventory((current) => [
          inventoryPayload,
          ...current.filter((item) => item.id !== inventoryPayload.id),
        ].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)));
      }
      if (stockMovementPayload) {
        setStockMovements((current) => [stockMovementPayload, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }
      setPurchaseForm(initialPurchaseForm());
      saveFeedback(
        "success",
        affectsInventory
          ? "Compra guardada con entrada de stock y existencias actualizadas."
          : "Movimiento guardado sin afectar inventario.",
      );
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible guardar el movimiento.");
    }
  };

  const handleSaleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const total = getNumericValue(saleForm.total);

    if (!saleForm.orderSummary.trim() || total <= 0) {
      saveFeedback("error", "Completa el pedido y el total.");
      return;
    }

    if (saleForm.deliveryType === "delivery" && !saleForm.deliveryAddress.trim()) {
      saveFeedback("error", "Completa la direccion para el delivery.");
      return;
    }

    const payload: Sale = {
      id: createId(),
      createdAt: new Date().toISOString(),
      date: getCurrentDate(),
      client: saleForm.client.trim(),
      detail: saleForm.detail.trim(),
      total,
      status: "pendiente",
      quantity: 1,
      productName: saleForm.orderSummary.trim(),
      deliveryType: saleForm.deliveryType,
      deliveryAddress: saleForm.deliveryAddress.trim(),
      orderItems: [
        {
          name: saleForm.orderSummary.trim(),
          quantity: 1,
          unitPrice: total,
          total,
        },
      ],
    };

    try {
      const ingredientStore = await loadIngredientStore();
      const inventoryResult = registerSale(ingredientStore, {
        ventaId: payload.id,
        fecha: payload.date,
        items: mapSaleOrderItemsToInventoryItems(payload.orderItems ?? []),
      });

      if (!inventoryResult.validation.canSell) {
        saveFeedback("error", inventoryResult.validation.errors.join(" · "));
        return;
      }

      await saveIngredientStore(inventoryResult.state);
      await addRecord("sales", payload);
      setSales((current) => [payload, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setSaleForm(initialSaleForm());
      saveFeedback(
        "success",
        inventoryResult.validation.warnings.length > 0
          ? `Venta guardada con advertencias: ${inventoryResult.validation.warnings.join(" · ")}`
          : "Venta guardada correctamente.",
      );
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible guardar la venta.");
    }
  };

  const addSaleFromOrder = async ({
    id,
    createdAt,
    date,
    client,
    detail,
    total,
    status,
    cashAmount,
    transferAmount,
    deliveryType,
    deliveryAddress,
    deliveryFee,
    deliveryPaymentMethod,
    discountAmount,
    fulfillmentTime,
    orderItems,
    quantity,
    productName,
  }: SaleFromOrderInput) => {
    if (orderItems.length === 0 || total <= 0) {
      saveFeedback("error", "No fue posible registrar la venta: el pedido esta vacio.");
      return false;
    }

    const saleId = id ?? createId();
    const saleCreatedAt = createdAt ?? new Date().toISOString();
    const existingSale = sales.find((item) => item.id === saleId);
    const payload: Sale = {
      id: saleId,
      createdAt: saleCreatedAt,
      date: date ?? getLocalDateFromIso(saleCreatedAt),
      client: client?.trim().toUpperCase() ?? "",
      detail: detail.trim().toUpperCase(),
      total,
      status: status ?? "pendiente",
      cashAmount,
      transferAmount,
      deliveryType,
      deliveryAddress: deliveryAddress?.trim(),
      deliveryFee,
      deliveryPaymentMethod: deliveryType === "delivery" ? deliveryPaymentMethod : undefined,
      discountAmount,
      fulfillmentTime: fulfillmentTime?.trim(),
      quantity,
      productName,
      orderItems,
    };

    try {
      if (existingSale) {
        await addRecord("sales", payload);
        setSales((current) => [payload, ...current.filter((item) => item.id !== payload.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        saveFeedback("success", "Venta del pedido actualizada.");
        return true;
      }

      const ingredientStore = await loadIngredientStore();
      const inventoryResult = registerSale(ingredientStore, {
        ventaId: payload.id,
        fecha: payload.date,
        items: mapSaleOrderItemsToInventoryItems(orderItems),
      });

      if (!inventoryResult.validation.canSell) {
        saveFeedback("error", inventoryResult.validation.errors.join(" · "));
        return false;
      }

      await saveIngredientStore(inventoryResult.state);
      await addRecord("sales", payload);
      setSales((current) => [payload, ...current.filter((item) => item.id !== payload.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      saveFeedback(
        "success",
        inventoryResult.validation.warnings.length > 0
          ? `Boleta guardada con advertencias: ${inventoryResult.validation.warnings.join(" · ")}`
          : "Boleta impresa y venta guardada.",
      );
      return true;
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible guardar la venta.");
      return false;
    }
  };

  const updateSaleStatus = async (id: string, status: SaleStatus, paymentAmounts?: { cashAmount?: number; transferAmount?: number }) => {
    const sale = sales.find((item) => item.id === id);

    if (!sale) {
      saveFeedback("error", "No fue posible encontrar la venta.");
      return;
    }

    const updatedSale: Sale = {
      ...sale,
      status,
      cashAmount: status === "mixto" ? paymentAmounts?.cashAmount ?? 0 : undefined,
      transferAmount: status === "mixto" ? paymentAmounts?.transferAmount ?? 0 : undefined,
    };

    try {
      await addRecord("sales", updatedSale);
      setSales((current) => current.map((item) => (item.id === id ? updatedSale : item)));
      saveFeedback("success", "Estado de pago actualizado.");
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible actualizar la venta.");
    }
  };

  const updateSaleDetails = async (
    id: string,
    updates: Pick<
      Sale,
      "client" | "detail" | "deliveryType" | "deliveryAddress" | "deliveryFee" | "deliveryPaymentMethod" | "fulfillmentTime"
    >,
  ) => {
    const sale = sales.find((item) => item.id === id);

    if (!sale) {
      saveFeedback("error", "No fue posible encontrar la venta.");
      return;
    }

    const updatedSale: Sale = {
      ...sale,
      client: updates.client.trim().toUpperCase(),
      detail: updates.detail.trim().toUpperCase(),
      deliveryType: updates.deliveryType,
      deliveryAddress: updates.deliveryAddress?.trim(),
      deliveryFee: updates.deliveryFee,
      deliveryPaymentMethod: updates.deliveryType === "delivery" ? updates.deliveryPaymentMethod : undefined,
      fulfillmentTime: updates.fulfillmentTime?.trim(),
    };

    try {
      await addRecord("sales", updatedSale);
      setSales((current) => current.map((item) => (item.id === id ? updatedSale : item)));
      saveFeedback("success", "Venta actualizada correctamente.");
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible actualizar la venta.");
    }
  };

  const handleInventorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = getNumericValue(inventoryForm.quantity);
    const unitPrice = getNumericValue(inventoryForm.unitPrice);

    if (!inventoryForm.name.trim() || quantity <= 0 || unitPrice <= 0) {
      saveFeedback("error", "Completa nombre, cantidad y precio unitario.");
      return;
    }

    const payload: InventoryItem = {
      id: createId(),
      createdAt: new Date().toISOString(),
      date: getCurrentDate(),
      name: inventoryForm.name.trim(),
      quantity,
      place: inventoryForm.place.trim(),
      unitPrice,
      total: quantity * unitPrice,
    };

    try {
      await addRecord("inventory", payload);
      setInventory((current) => [payload, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setInventoryForm(initialInventoryForm());
      saveFeedback("success", "Producto agregado al inventario.");
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible guardar el inventario.");
    }
  };

  const exportBackup = () => {
    const payload: BackupPayload = {
      exportedAt: new Date().toISOString(),
      purchases,
      sales,
      inventory,
      stockMovements,
    };

    downloadFile(
      `respaldo-finanzas-${getCurrentDate()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    saveFeedback("success", "Respaldo JSON descargado.");
  };

  const exportPurchasesCsv = () => {
    downloadFile(`compras-${getCurrentDate()}.csv`, purchaseRowsToCsv(purchases), "text/csv;charset=utf-8");
  };

  const exportSalesCsv = () => {
    downloadFile(`ventas-${getCurrentDate()}.csv`, salesRowsToCsv(sales), "text/csv;charset=utf-8");
  };

  const importPurchasesCsv = async (csvContent: string) => {
    try {
      csvContent = csvContent.replace(/^\ufeff/, "");
      const lines = csvContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        saveFeedback("error", "El archivo CSV debe tener al menos una fila de datos.");
        return;
      }

      const header = parseCsvLine(lines[0]).map(normalizeCsvHeader);
      const dateIndex = header.indexOf("FECHA");
      const detailIndex = header.indexOf("DETALLE");
      const packageIndex = header.indexOf("PAQUETE");
      const unitIndex = header.indexOf("UNIDAD");
      const placeIndex = header.indexOf("LUGAR");
      const paymentMethodIndex = header.indexOf("FORMA PAGO");
      const unitPriceIndex = header.indexOf("PRECIO");
      const totalIndex = header.indexOf("TOTAL");
      const categoryIndex = header.indexOf("CATEGORIA");

      if ([dateIndex, detailIndex, totalIndex, categoryIndex].some((index) => index === -1)) {
        saveFeedback(
          "error",
          "El formato del CSV no es válido. Debe incluir al menos FECHA, DETALLE, TOTAL y CATEGORIA.",
        );
        return;
      }

      const newPurchases: Purchase[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]).map((part) => part.replace(/^"|"$/g, "").trim());
        const date = parsePurchaseDate(parts[dateIndex] ?? "");
        const detail = (parts[detailIndex] ?? "").trim();
        const packageQuantity = packageIndex === -1 ? 0 : Number.parseFloat((parts[packageIndex] ?? "").replace(",", "."));
        const unitQuantity = unitIndex === -1 ? 0 : Number.parseFloat((parts[unitIndex] ?? "").replace(",", "."));
        const quantity = Number.isFinite(packageQuantity) && packageQuantity > 0
          ? packageQuantity
          : Number.isFinite(unitQuantity) && unitQuantity > 0
            ? unitQuantity
            : 1;
        const total = parseCurrencyValue(parts[totalIndex] ?? "");
        const csvUnitPrice = unitPriceIndex === -1 ? NaN : parseCurrencyValue(parts[unitPriceIndex] ?? "");

        if (!date || !detail || !Number.isFinite(quantity) || quantity <= 0 || isNaN(total) || total <= 0) {
          continue;
        }

        const movementType = resolveMovementType(parts[categoryIndex] ?? "");
        const category = resolveMovementCategory(detail, movementType);
        const paymentMethod = paymentMethodIndex === -1 ? "otro" : parseMovementPaymentMethod(parts[paymentMethodIndex] ?? "");
        const unitRaw = unitIndex === -1 ? "" : (parts[unitIndex] ?? "").trim();
        const unitPrice = Number.isFinite(csvUnitPrice) && csvUnitPrice > 0 ? csvUnitPrice : Math.round(total / quantity);

        const purchase: Purchase = {
          id: createId(),
          createdAt: createSaleCreatedAt(date),
          date,
          detail: detail.toUpperCase(),
          quantity,
          supplier: placeIndex === -1 ? paymentMethod : (parts[placeIndex] || paymentMethod).toUpperCase(),
          unitPrice,
          total,
          entryType: movementType === "inversion" ? "investment" : "expense",
          itemType: movementType === "compra" ? "sale_inventory" : "operating_expense",
          affectsInventory: movementType === "compra",
          stockControl: "simple",
          internalSupplyMode: "expense",
          movementType,
          category,
          unit: unitRaw ? `${unitRaw} unidad` : "unidad",
          amount: total,
          paymentMethod,
        };
        newPurchases.push(purchase);
      }

      if (newPurchases.length === 0) {
        saveFeedback("error", "No se encontraron movimientos válidos en el CSV.");
        return;
      }

      await Promise.all(newPurchases.map((purchase) => addRecord("purchases", purchase)));
      setPurchases((current) => [...newPurchases.map(normalizePurchase), ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      saveFeedback("success", `Se importaron ${newPurchases.length} movimientos correctamente.`);
    } catch {
      saveFeedback("error", "Error al importar el CSV.");
    }
  };

  const importSalesCsv = async (csvContent: string) => {
    try {
      csvContent = csvContent.replace(/^\ufeff/, "");
      const lines = csvContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        saveFeedback("error", "El archivo CSV debe tener al menos una fila de datos.");
        return;
      }

      const header = parseCsvLine(lines[0]).map(normalizeCsvHeader);
      const dateIndex = header.indexOf("FECHA");
      const clientIndex = header.indexOf("CLIENTE");
      const countIndex = header.indexOf("CANT");
      const exportedOrderIndex = header.indexOf("PEDIDO");
      const productIndex = header.indexOf("PRODUCTO");
      const detailIndex = header.includes("DETALLE DE PEDIDO") ? header.indexOf("DETALLE DE PEDIDO") : header.indexOf("DETALLE");
      const deliveryTypeIndex = header.indexOf("ENTREGA");
      const deliveryAddressIndex = header.indexOf("DIRECCION");
      const fulfillmentTimeIndex = header.indexOf("HORA ENTREGA");
      const deliveryFeeIndex = header.indexOf("DELIVERY");
      const deliveryPaymentMethodIndex = header.indexOf("PAGO_DELIVERY");
      const discountIndex = header.indexOf("DESCUENTO");
      const totalIndex = header.indexOf("TOTAL");
      const collectedTotalIndex = header.indexOf("TOTAL_COBRADO");
      const cashAmountIndex = header.indexOf("PAGO_EFECTIVO");
      const transferAmountIndex = header.indexOf("PAGO_DEBITO");
      const statusIndex = header.indexOf("ESTADO");

      const hasLegacyDetail = detailIndex !== -1 && productIndex === -1;
      const hasProductDetail = productIndex !== -1 && detailIndex !== -1;
      const hasExportedDetail = exportedOrderIndex !== -1;

      if (
        [dateIndex, clientIndex, statusIndex].some((index) => index === -1) ||
        (totalIndex === -1 && collectedTotalIndex === -1) ||
        (!hasLegacyDetail && !hasProductDetail && !hasExportedDetail)
      ) {
        saveFeedback(
          "error",
          "El formato del CSV no es válido. Debe incluir FECHA, CLIENTE, TOTAL, ESTADO y el detalle de la venta.",
        );
        return;
      }

      const parseStatus = (raw: string) => {
        const status = normalizeCsvHeader(raw);
        if (status.includes("PENDIENTE")) return "pendiente";
        if (status.includes("MIXTO")) return "mixto";
        if (status.includes("EFECTIVO")) return "efectivo";
        if (status.includes("TRANSFER") || status.includes("DEBITO") || status.includes("TRANSF")) return "transferencia";
        return "transferencia";
      };

      const newSales: Sale[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]).map((part) => part.replace(/^"|"$/g, "").trim());
        const date = parseSaleDate(parts[dateIndex] ?? "");
        const client = (parts[clientIndex] ?? "").trim();
        const product = productIndex === -1 ? "" : (parts[productIndex] ?? "").trim();
        const orderText = exportedOrderIndex === -1 ? "" : (parts[exportedOrderIndex] ?? "").trim();
        const extraDetail = detailIndex === -1 ? "" : (parts[detailIndex] ?? "").trim();
        const netTotal = totalIndex === -1 ? 0 : getOptionalCurrencyValue(parts[totalIndex] ?? "");
        const collectedTotal = collectedTotalIndex === -1 ? 0 : getOptionalCurrencyValue(parts[collectedTotalIndex] ?? "");
        const deliveryFee = deliveryFeeIndex === -1 ? 0 : getOptionalCurrencyValue(parts[deliveryFeeIndex] ?? "");
        const discountAmount = discountIndex === -1 ? 0 : getOptionalCurrencyValue(parts[discountIndex] ?? "");
        const cashAmount = cashAmountIndex === -1 ? undefined : getOptionalCurrencyValue(parts[cashAmountIndex] ?? "");
        const transferAmount = transferAmountIndex === -1 ? undefined : getOptionalCurrencyValue(parts[transferAmountIndex] ?? "");
        const total = collectedTotal > 0 ? collectedTotal : netTotal + deliveryFee;
        const detail = [orderText || product, extraDetail].filter(Boolean).join(" · ");
        const deliveryType = deliveryTypeIndex === -1 ? (deliveryFee > 0 ? "delivery" : "retiro") : parseDeliveryType(parts[deliveryTypeIndex] ?? "");
        const quantity = Number.parseFloat((parts[countIndex] ?? "1").replace(",", ".")) || 1;
        const orderItems = hasExportedDetail ? parseExportedOrderItems(orderText, Math.max(0, netTotal)) : undefined;

        if (!date || !detail || isNaN(total) || total <= 0) continue;

        const sale: Sale = {
          id: createId(),
          createdAt: createSaleCreatedAt(date),
          date,
          client: client.toUpperCase(),
          detail: detail.toUpperCase(),
          total,
          status: parseStatus(parts[statusIndex] ?? ""),
          cashAmount,
          transferAmount,
          quantity: orderItems?.reduce((totalItems, item) => totalItems + item.quantity, 0) || quantity,
          productName: product || orderText || detail,
          deliveryType,
          deliveryAddress: deliveryAddressIndex === -1 ? "" : (parts[deliveryAddressIndex] ?? "").trim(),
          deliveryFee: deliveryType === "delivery" ? deliveryFee : undefined,
          deliveryPaymentMethod:
            deliveryType === "delivery" && deliveryPaymentMethodIndex !== -1
              ? parseDeliveryPaymentMethod(parts[deliveryPaymentMethodIndex] ?? "")
              : undefined,
          discountAmount,
          fulfillmentTime: fulfillmentTimeIndex === -1 ? "" : (parts[fulfillmentTimeIndex] ?? "").trim(),
          orderItems,
        };

        newSales.push(sale);
      }

      if (newSales.length === 0) {
        saveFeedback("error", "No se encontraron ventas válidas en el CSV.");
        return;
      }

      await Promise.all(newSales.map((sale) => addRecord('sales', sale)));
      setSales((current) => [...newSales, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      saveFeedback("success", `Se importaron ${newSales.length} ventas correctamente.`);
    } catch {
      saveFeedback("error", "Error al importar el CSV.");
    }
  };

  const exportInventoryCsv = () => {
    downloadFile(`inventario-${getCurrentDate()}.csv`, inventoryRowsToCsv(inventory), "text/csv;charset=utf-8");
  };

  const startEditPurchase = (purchase: Purchase) => {
    const normalizedPurchase = normalizePurchase(purchase);
    setEditingPurchaseId(normalizedPurchase.id);
    setPurchaseForm({
      type: normalizedPurchase.movementType ?? "compra",
      category: normalizedPurchase.category ?? "materia_prima",
      detail: normalizedPurchase.detail,
      quantity: String(normalizedPurchase.quantity),
      unit: normalizedPurchase.unit ?? "unidad",
      amount: String(normalizedPurchase.amount ?? normalizedPurchase.total),
      paymentMethod: normalizedPurchase.paymentMethod ?? "otro",
      date: normalizedPurchase.date,
    });
  };

  const cancelEditPurchase = () => {
    setEditingPurchaseId(null);
    setPurchaseForm(initialPurchaseForm());
  };

  return {
    loading,
    error,
    toast,
    purchases,
    sales,
    inventory,
    stockMovements,
    purchaseForm,
    setPurchaseForm,
    editingPurchaseId,
    saleForm,
    setSaleForm,
    inventoryForm,
    setInventoryForm,
    purchasePreviewTotal,
    inventoryPreviewTotal,
    totals,
    chartData,
    handleDelete,
    handlePurchaseSubmit,
    startEditPurchase,
    cancelEditPurchase,
    handleSaleSubmit,
    addSaleFromOrder,
    updateSaleStatus,
    updateSaleDetails,
    handleInventorySubmit,
    exportBackup,
    exportPurchasesCsv,
    exportSalesCsv,
    exportInventoryCsv,
    importPurchasesCsv,
    importSalesCsv,
    handleClearAllData,
  };
}
