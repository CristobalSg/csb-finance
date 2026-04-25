export type SaleStatus = "efectivo" | "transferencia" | "pendiente";
export type PurchaseEntryType = "investment" | "expense";
export type PurchaseItemType = "sale_inventory" | "rotating_input" | "operating_expense" | "internal_supply";
export type StockControlMode = "simple" | "batch" | "consumption";
export type InternalSupplyMode = "expense" | "stock";
export type DeliveryType = "retiro" | "delivery";

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
  quantity?: number;
  productName?: string;
  deliveryType?: DeliveryType;
  deliveryAddress?: string;
  deliveryFee?: number;
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
