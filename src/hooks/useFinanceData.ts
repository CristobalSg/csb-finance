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
import {
  loadIngredientStore,
  registerSale,
  saveIngredientStore,
} from "../data/ingredientStore";
import { getCurrentDate, getLastDays } from "../lib/date";
import { addRecord, clearAllRecords, deleteRecord, getAllRecords } from "../lib/db";
import { downloadFile, inventoryRowsToCsv, purchaseRowsToCsv, salesRowsToCsv } from "../lib/format";
import { createId } from "../lib/id";
import type {
  BackupPayload,
  DeliveryType,
  InventoryItem,
  Purchase,
  PurchaseItemType,
  Sale,
  SaleOrderItem,
  SaleStatus,
  StockControlMode,
  StockMovement,
  StoreName,
} from "../types";
import type { InventorySaleInputItem } from "../types/inventory";

const getNumericValue = (value: string) => Number(value || 0);
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
  const dateParts = raw.split("-").map((part) => part.trim());

  if (dateParts.length !== 3) {
    return null;
  }

  const [day, month, yearPart] = dateParts;
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const parseCurrencyValue = (value: string) => {
  const normalized = value.replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : NaN;
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
});

const purchaseAffectsInventory = (purchase: Pick<PurchaseFormState, "itemType" | "internalSupplyMode">) =>
  purchase.itemType === "sale_inventory" ||
  purchase.itemType === "rotating_input" ||
  (purchase.itemType === "internal_supply" && purchase.internalSupplyMode === "stock");

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

  const estimate = Math.round(sale.total / price);
  if (estimate <= 0) {
    return 0;
  }

  const difference = Math.abs(sale.total - estimate * price);
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

  const purchasePreviewTotal = getNumericValue(purchaseForm.quantity) * getNumericValue(purchaseForm.unitPrice);
  const inventoryPreviewTotal = getNumericValue(inventoryForm.quantity) * getNumericValue(inventoryForm.unitPrice);

  const totals = useMemo(() => {
    const income = sales.reduce((sum, item) => sum + item.total, 0);
    const collectedIncome = sales.filter((item) => item.status !== "pendiente").reduce((sum, item) => sum + item.total, 0);
    const cashIncome = sales.filter((item) => item.status === "efectivo").reduce((sum, item) => sum + item.total, 0);
    const transferIncome = sales.filter((item) => item.status === "transferencia").reduce((sum, item) => sum + item.total, 0);
    const pendingIncome = sales.filter((item) => item.status === "pendiente").reduce((sum, item) => sum + item.total, 0);
    const salesCount = sales.length;
    const expenses = purchases.reduce((sum, item) => sum + item.total, 0);
    const purchasesCount = purchases.length;
    const inventoryPurchaseCost = purchases
      .filter((item) => item.affectsInventory)
      .reduce((sum, item) => sum + item.total, 0);
    const nonInventoryPurchaseCost = purchases
      .filter((item) => !item.affectsInventory)
      .reduce((sum, item) => sum + item.total, 0);
    const initialInvestment = purchases
      .filter((item) => item.entryType === "investment")
      .reduce((sum, item) => sum + item.total, 0);
    const operatingExpenses = Math.max(0, expenses - initialInvestment);
    const investmentCount = purchases.filter((item) => item.entryType === "investment").length;
    const expenseCount = purchasesCount - investmentCount;

    const inventoryValue = inventory.reduce((sum, item) => sum + item.total, 0);

    const utilityTotal = income - operatingExpenses;
    const profitability = income > 0 ? utilityTotal / income : 0;
    const marginOnSpend = operatingExpenses > 0 ? utilityTotal / operatingExpenses : 0;
    const roi = initialInvestment > 0 ? utilityTotal / initialInvestment : 0;

    const activityDates = new Set([
      ...sales.map((item) => item.date),
      ...purchases.filter((item) => item.entryType !== "investment").map((item) => item.date),
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

    return {
      income,
      collectedIncome,
      cashIncome,
      transferIncome,
      pendingIncome,
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
      net: collectedIncome - operatingExpenses,
      expectedCash: collectedIncome - operatingExpenses,
    };
  }, [inventory, purchases, sales]);

  const chartData = useMemo(() => {
    const lastDays = getLastDays(7);

    return lastDays.map((date) => ({
      date,
      income: sales.filter((item) => item.date === date).reduce((sum, item) => sum + item.total, 0),
      expense: purchases
        .filter((item) => item.date === date && item.entryType !== "investment")
        .reduce((sum, item) => sum + item.total, 0),
    }));
  }, [purchases, sales]);

  const handleDelete = async (storeName: StoreName, id: string) => {
    const confirmed = window.confirm("Se eliminara este registro del dispositivo. Quieres continuar?");
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
    const unitPrice = getNumericValue(purchaseForm.unitPrice);
    const affectsInventory = purchaseAffectsInventory(purchaseForm);
    const stockControl = resolveStockControl(purchaseForm.itemType, purchaseForm.stockControl);

    if (!purchaseForm.detail.trim() || !purchaseForm.supplier.trim() || quantity <= 0 || unitPrice <= 0) {
      saveFeedback("error", "Completa detalle, proveedor, cantidad y precio unitario.");
      return;
    }

    const createdAt = new Date().toISOString();
    const purchaseId = createId();
    const stockMovementId = affectsInventory ? createId() : undefined;
    const inventoryKey = getInventoryKey(purchaseForm.detail, purchaseForm.itemType, stockControl);
    const existingInventoryItem = affectsInventory
      ? inventory.find((item) => getInventoryKey(item.name, item.itemType, item.stockControl) === inventoryKey)
      : undefined;
    const inventoryItemId = affectsInventory ? existingInventoryItem?.id ?? createId() : undefined;

    const payload: Purchase = {
      id: purchaseId,
      createdAt,
      date: getCurrentDate(),
      detail: purchaseForm.detail.trim(),
      quantity,
      supplier: purchaseForm.supplier.trim(),
      unitPrice,
      total: quantity * unitPrice,
      entryType: "expense",
      itemType: purchaseForm.itemType,
      affectsInventory,
      stockControl,
      internalSupplyMode: purchaseForm.internalSupplyMode,
      inventoryItemId,
      stockMovementId,
    };

    const inventoryPayload: InventoryItem | null =
      affectsInventory && inventoryItemId
        ? {
            id: inventoryItemId,
            createdAt: existingInventoryItem?.createdAt ?? createdAt,
            date: getCurrentDate(),
            name: purchaseForm.detail.trim(),
            quantity: (existingInventoryItem?.quantity ?? 0) + quantity,
            place: purchaseForm.supplier.trim(),
            unitPrice,
            total: (existingInventoryItem?.total ?? 0) + quantity * unitPrice,
            itemType: purchaseForm.itemType,
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
            date: getCurrentDate(),
            itemName: purchaseForm.detail.trim(),
            itemType: purchaseForm.itemType,
            movementType: "entry",
            quantity,
            unitCost: unitPrice,
            total: quantity * unitPrice,
            sourceType: "purchase",
            sourceId: purchaseId,
            supplier: purchaseForm.supplier.trim(),
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
          : "Compra guardada como gasto sin afectar inventario.",
      );
    } catch (submitError) {
      saveFeedback("error", submitError instanceof Error ? submitError.message : "No fue posible guardar la compra.");
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
    client,
    detail,
    total,
    deliveryType,
    deliveryAddress,
    deliveryFee,
    fulfillmentTime,
    orderItems,
    quantity,
    productName,
  }: {
    client?: string;
    detail: string;
    total: number;
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    deliveryFee?: number;
    fulfillmentTime?: string;
    orderItems: SaleOrderItem[];
    quantity: number;
    productName?: string;
  }) => {
    if (orderItems.length === 0 || total <= 0) {
      saveFeedback("error", "No fue posible registrar la venta: el pedido esta vacio.");
      return false;
    }

    const payload: Sale = {
      id: createId(),
      createdAt: new Date().toISOString(),
      date: getCurrentDate(),
      client: client?.trim().toUpperCase() ?? "",
      detail: detail.trim().toUpperCase(),
      total,
      status: "pendiente",
      deliveryType,
      deliveryAddress: deliveryAddress?.trim(),
      deliveryFee,
      fulfillmentTime: fulfillmentTime?.trim(),
      quantity,
      productName,
      orderItems,
    };

    try {
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
      setSales((current) => [payload, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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

  const updateSaleStatus = async (id: string, status: SaleStatus) => {
    const sale = sales.find((item) => item.id === id);

    if (!sale) {
      saveFeedback("error", "No fue posible encontrar la venta.");
      return;
    }

    const updatedSale: Sale = {
      ...sale,
      status,
    };

    try {
      await addRecord("sales", updatedSale);
      setSales((current) => current.map((item) => (item.id === id ? updatedSale : item)));
      saveFeedback("success", "Estado de pago actualizado.");
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

  const importPurchasesCsv = async (csvContent: string, entryType: Purchase["entryType"]) => {
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
      const quantityIndex = header.indexOf("CANTIDAD");
      const supplierIndex = header.indexOf("LUGAR");
      const unitPriceIndex = header.indexOf("PRECIO");

      if ([dateIndex, detailIndex, quantityIndex, supplierIndex, unitPriceIndex].some((index) => index === -1)) {
        saveFeedback(
          "error",
          "El formato del CSV no es válido. Debe incluir al menos FECHA, DETALLE, Cantidad, LUGAR y PRECIO.",
        );
        return;
      }

      const newPurchases: Purchase[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]).map((part) => part.replace(/^"|"$/g, "").trim());
        const date = parsePurchaseDate(parts[dateIndex] ?? "");
        const detail = (parts[detailIndex] ?? "").trim();
        const supplier = (parts[supplierIndex] ?? "").trim();
        const quantity = Number.parseFloat((parts[quantityIndex] ?? "").replace(",", "."));
        const unitPrice = parseCurrencyValue(parts[unitPriceIndex] ?? "");

        if (!date || !detail || !supplier || !Number.isFinite(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
          continue;
        }

        const purchase: Purchase = {
          id: createId(),
          createdAt: new Date().toISOString(),
          date,
          detail: detail.toUpperCase(),
          quantity,
          supplier: supplier.toUpperCase(),
          unitPrice,
          total: quantity * unitPrice,
          entryType,
        };
        newPurchases.push(purchase);
      }

      if (newPurchases.length === 0) {
        saveFeedback("error", "No se encontraron compras válidas en el CSV.");
        return;
      }

      await Promise.all(newPurchases.map((purchase) => addRecord("purchases", purchase)));
      setPurchases((current) => [...newPurchases.map(normalizePurchase), ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      saveFeedback(
        "success",
        `Se importaron ${newPurchases.length} compras como ${entryType === "investment" ? "inversion inicial" : "gasto"}.`,
      );
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
      const productIndex = header.indexOf("PRODUCTO");
      const detailIndex = header.indexOf("DETALLE DE PEDIDO");
      const totalIndex = header.indexOf("TOTAL");
      const statusIndex = header.indexOf("ESTADO");

      const hasLegacyDetail = detailIndex !== -1 && productIndex === -1;
      const hasProductDetail = productIndex !== -1 && detailIndex !== -1;

      if (
        [dateIndex, clientIndex, totalIndex, statusIndex].some((index) => index === -1) ||
        (!hasLegacyDetail && !hasProductDetail)
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
        if (status.includes("EFECTIVO")) return "efectivo";
        if (status.includes("TRANSFER") || status.includes("DEBITO") || status.includes("TRANSF")) return "transferencia";
        return "transferencia";
      };

      const newSales: Sale[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]).map((part) => part.replace(/^"|"$/g, "").trim());
        const date = parsePurchaseDate(parts[dateIndex] ?? "");
        const client = (parts[clientIndex] ?? "").trim();
        const product = productIndex === -1 ? "" : (parts[productIndex] ?? "").trim();
        const extraDetail = detailIndex === -1 ? "" : (parts[detailIndex] ?? "").trim();
        const total = parseCurrencyValue(parts[totalIndex] ?? "");
        const detail = [product, extraDetail].filter(Boolean).join(" · ");

        if (!date || !detail || isNaN(total) || total <= 0) continue;

        const sale: Sale = {
          id: createId(),
          createdAt: new Date().toISOString(),
          date,
          client: client.toUpperCase(),
          detail: detail.toUpperCase(),
          total,
          status: parseStatus(parts[statusIndex] ?? ""),
          quantity: Number.parseFloat((parts[countIndex] ?? "1").replace(",", ".")) || 1,
          productName: product || detail,
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
    handleSaleSubmit,
    addSaleFromOrder,
    updateSaleStatus,
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
