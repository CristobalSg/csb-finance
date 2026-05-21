export type SaleStatus = "efectivo" | "transferencia" | "mixto" | "pendiente";
export type PurchaseEntryType = "investment" | "expense";
export type PurchaseItemType = "sale_inventory" | "rotating_input" | "operating_expense" | "internal_supply";
export type StockControlMode = "simple" | "batch" | "consumption";
export type InternalSupplyMode = "expense" | "stock";
export type MovementType = "compra" | "personal" | "operativo" | "inversion";
export type MovementCategory =
  | "materia_prima"
  | "bebidas"
  | "envases"
  | "insumos_cocina"
  | "limpieza"
  | "gas"
  | "transporte"
  | "internet"
  | "luz"
  | "agua"
  | "personal"
  | "inversion";
export type MovementPaymentMethod = "efectivo" | "debito" | "transferencia" | "credito" | "otro";
export type DeliveryType = "retiro" | "delivery";
export type DeliveryPaymentMethod = "efectivo" | "debito" | "nosotros";

export type Purchase = {
  id: string;
  createdAt: string;
  date: string;
  detail: string;
  quantity: number;
  supplier: string;
  unitPrice: number;
  total: number;
  entryType?: PurchaseEntryType;
  itemType?: PurchaseItemType;
  affectsInventory?: boolean;
  stockControl?: StockControlMode;
  internalSupplyMode?: InternalSupplyMode;
  movementType?: MovementType;
  category?: MovementCategory;
  unit?: string;
  amount?: number;
  paymentMethod?: MovementPaymentMethod;
  inventoryItemId?: string;
  stockMovementId?: string;
};

export type Sale = {
  id: string;
  createdAt: string;
  date: string;
  client: string;
  detail: string;
  total: number;
  status: SaleStatus;
  cashAmount?: number;
  transferAmount?: number;
  quantity?: number;
  productName?: string;
  deliveryType?: DeliveryType;
  deliveryAddress?: string;
  deliveryFee?: number;
  deliveryPaymentMethod?: DeliveryPaymentMethod;
  discountAmount?: number;
  fulfillmentTime?: string;
  orderItems?: SaleOrderItem[];
};

export type SaleOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  drink?: string;
  sauce?: string;
  removedIngredients?: string[];
  familyBurgers?: SaleOrderFamilyBurger[];
};

export type SaleOrderFamilyBurger = {
  label: string;
  name: string;
  removedIngredients?: string[];
};

export type WeeklySalesStats = {
  weekKey: string;
  label: string;
  salesCount: number;
  income: number;
  burgers: number;
  fries: number;
  drinks: number;
  nuggets: number;
  sauces: number;
  other: number;
  products: { name: string; quantity: number }[];
  drinksBreakdown: { name: string; quantity: number }[];
  saucesBreakdown: { name: string; quantity: number }[];
};

export type InventoryItem = {
  id: string;
  createdAt: string;
  date: string;
  name: string;
  quantity: number;
  place: string;
  unitPrice: number;
  total: number;
  itemType?: PurchaseItemType;
  stockControl?: StockControlMode;
  sourcePurchaseId?: string;
  updatedAt?: string;
};

export type StockMovement = {
  id: string;
  createdAt: string;
  date: string;
  itemName: string;
  itemType: PurchaseItemType;
  movementType: "entry" | "exit" | "adjustment";
  quantity: number;
  unitCost: number;
  total: number;
  sourceType: "purchase" | "sale" | "manual";
  sourceId: string;
  supplier?: string;
  stockControl?: StockControlMode;
};

export type StoreName = "purchases" | "sales" | "inventory" | "stockMovements";

export type BackupPayload = {
  exportedAt: string;
  purchases: Purchase[];
  sales: Sale[];
  inventory: InventoryItem[];
  stockMovements?: StockMovement[];
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  color: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  dueDate: string;
  completed: boolean;
  type: "task" | "exam";
};

export type TaskInput = {
  title: string;
  description: string;
  subjectId: string;
  dueDate: string;
  completed: boolean;
  type: "task" | "exam";
};

export type StoredFileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  subjectId: string;
  uploadedAt: string;
  file: File;
};
