import type { ReactNode } from "react";

import { DashboardIcon, HomeIcon, IngredientIcon, InventoryIcon, PurchaseIcon, SalesIcon } from "../components/icons";
import type { DeliveryType, InternalSupplyMode, PurchaseEntryType, PurchaseItemType, SaleStatus, StockControlMode } from "../types";

export type PurchaseFormState = {
  detail: string;
  quantity: string;
  supplier: string;
  unitPrice: string;
  entryType: PurchaseEntryType;
  itemType: PurchaseItemType;
  stockControl: StockControlMode;
  internalSupplyMode: InternalSupplyMode;
};

export type SaleFormState = {
  client: string;
  orderSummary: string;
  detail: string;
  total: string;
  status: SaleStatus;
  deliveryType: DeliveryType;
  deliveryAddress: string;
};

export type InventoryFormState = {
  name: string;
  quantity: string;
  place: string;
  unitPrice: string;
};

export type ToastState = {
  tone: "success" | "error";
  message: string;
};

export type NavItem = {
  id: "home" | "dashboard" | "compras" | "ventas" | "inventario" | "ingredientes";
  label: string;
  icon: ReactNode;
};

export const shellCardClass =
  "rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_var(--app-shadow)] backdrop-blur sm:p-6";

export const systemName = "Finanzas Ceeseburgers C&K";

export const saleStatusLabels: Record<SaleStatus, string> = {
  efectivo: "Pagado efectivo",
  transferencia: "Pagado transferencia",
  pendiente: "Pendiente",
};

export const purchaseEntryTypeLabels: Record<PurchaseEntryType, string> = {
  investment: "Inversion inicial",
  expense: "Gasto",
};

export const purchaseItemTypeLabels: Record<PurchaseItemType, string> = {
  sale_inventory: "Inventario para venta",
  rotating_input: "Insumo rotativo",
  operating_expense: "Gasto operativo",
  internal_supply: "Suministro interno",
};

export const stockControlModeLabels: Record<StockControlMode, string> = {
  simple: "Stock simple",
  batch: "Control por lote",
  consumption: "Control por consumo",
};

export const internalSupplyModeLabels: Record<InternalSupplyMode, string> = {
  expense: "Registrar como gasto",
  stock: "Registrar como stock interno",
};

export const initialPurchaseForm = (): PurchaseFormState => ({
  detail: "",
  quantity: "",
  supplier: "",
  unitPrice: "",
  entryType: "expense",
  itemType: "sale_inventory",
  stockControl: "simple",
  internalSupplyMode: "expense",
});

export const initialSaleForm = (): SaleFormState => ({
  client: "",
  orderSummary: "",
  detail: "",
  total: "",
  status: "pendiente",
  deliveryType: "retiro",
  deliveryAddress: "",
});

export const initialInventoryForm = (): InventoryFormState => ({
  name: "",
  quantity: "",
  place: "",
  unitPrice: "",
});

export const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { id: "compras", label: "Compras", icon: <PurchaseIcon /> },
  { id: "ventas", label: "Ventas", icon: <SalesIcon /> },
  { id: "inventario", label: "Inventario", icon: <InventoryIcon /> },
  { id: "ingredientes", label: "Control de ingredientes", icon: <IngredientIcon /> },
];
