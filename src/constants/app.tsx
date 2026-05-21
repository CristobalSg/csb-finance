import type { ReactNode } from "react";

import { DashboardIcon, EventIcon, HomeIcon, IngredientIcon, InventoryIcon, PurchaseIcon, SettingsIcon } from "../components/icons";
import type {
  DeliveryPaymentMethod,
  DeliveryType,
  InternalSupplyMode,
  MovementCategory,
  MovementPaymentMethod,
  MovementType,
  PurchaseEntryType,
  PurchaseItemType,
  SaleStatus,
  StockControlMode,
} from "../types";

export type PurchaseFormState = {
  type: MovementType;
  category: MovementCategory;
  detail: string;
  quantity: string;
  unit: string;
  amount: string;
  paymentMethod: MovementPaymentMethod;
  date: string;
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
  id: "home" | "dashboard" | "movimientos" | "ventas" | "inventario" | "ingredientes" | "eventos" | "configuracion";
  label: string;
  icon: ReactNode;
};

export const shellCardClass =
  "rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_var(--app-shadow)] backdrop-blur sm:p-6";

export const systemName = "Finanzas Ceeseburgers C&K";

export const saleStatusLabels: Record<SaleStatus, string> = {
  efectivo: "Pagado efectivo",
  transferencia: "Pagado transferencia",
  mixto: "Pago mixto",
  pendiente: "Pendiente",
};

export const deliveryPaymentMethodLabels: Record<DeliveryPaymentMethod, string> = {
  efectivo: "Efectivo",
  debito: "Debito",
  nosotros: "Nosotros lo hacemos",
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

export const movementTypeLabels: Record<MovementType, string> = {
  compra: "Compra",
  personal: "Personal",
  operativo: "Operativo",
  inversion: "Inversion",
};

export const movementCategoryLabels: Record<MovementCategory, string> = {
  materia_prima: "Materia prima",
  bebidas: "Bebidas",
  envases: "Envases",
  insumos_cocina: "Insumos cocina",
  limpieza: "Limpieza",
  gas: "Gas",
  transporte: "Transporte",
  internet: "Internet",
  luz: "Luz",
  agua: "Agua",
  personal: "Personal",
  inversion: "Inversion",
};

export const movementPaymentMethodLabels: Record<MovementPaymentMethod, string> = {
  efectivo: "Efectivo",
  debito: "Debito",
  transferencia: "Transferencia",
  credito: "Credito",
  otro: "Otro",
};

export const movementCategoriesByType: Record<MovementType, MovementCategory[]> = {
  compra: ["materia_prima", "bebidas", "envases", "insumos_cocina", "limpieza"],
  personal: ["personal"],
  operativo: ["gas", "transporte", "internet", "luz", "agua"],
  inversion: ["inversion"],
};

export const initialPurchaseForm = (): PurchaseFormState => ({
  type: "compra",
  category: "materia_prima",
  detail: "",
  quantity: "",
  unit: "unidad",
  amount: "",
  paymentMethod: "efectivo",
  date: new Date().toISOString().slice(0, 10),
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
  { id: "movimientos", label: "Movimientos", icon: <PurchaseIcon /> },
  { id: "inventario", label: "Inventario", icon: <InventoryIcon /> },
  { id: "ingredientes", label: "Control de ingredientes", icon: <IngredientIcon /> },
  { id: "eventos", label: "Eventos", icon: <EventIcon /> },
  { id: "configuracion", label: "Configuracion", icon: <SettingsIcon /> },
];
