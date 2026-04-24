export type IngredientControlType = "manual" | "automatico";
export type IngredientUnit = "unidad" | "porcion" | "gramos" | "ml" | "manual";
export type IngredientRelationType = "obligatorio" | "opcional" | "reemplazable";

export type Ingredient = {
  id: string;
  nombre: string;
  disponible: boolean;
  tipo_control: IngredientControlType;
  unidad: IngredientUnit;
  stock_actual: number | null;
  stock_minimo: number | null;
};

export type ProductIngredient = {
  producto_id: string;
  ingrediente_id: string;
  tipo: IngredientRelationType;
  cantidad_consumida: number | null;
};

export type MenuProductReference = {
  id: string;
  nombre: string;
  categoria: string;
};

export type ProductIngredientStatus = "bloqueado" | "advertencia" | "disponible";

export type ProductIngredientEvaluation = {
  product: MenuProductReference;
  status: ProductIngredientStatus;
  blockingIngredients: Ingredient[];
  warningIngredients: Ingredient[];
};

export type InventoryPurchase = {
  id: string;
  fecha: string;
  items: InventoryPurchaseItem[];
};

export type InventoryPurchaseItem = {
  id: string;
  compra_id: string;
  ingrediente_id: string;
  cantidad: number;
  costo_total?: number;
};

export type InventorySale = {
  id: string;
  fecha: string;
  items: InventorySaleItem[];
};

export type InventorySaleItem = {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
};

export type InventorySaleInputItem = {
  productId?: string;
  productName: string;
  quantity: number;
  drink?: string;
  sauce?: string;
  removedIngredients?: string[];
};

export type InventoryValidationResult = {
  canSell: boolean;
  errors: string[];
  warnings: string[];
};

export type IngredientStoreState = {
  ingredientes: Ingredient[];
  productos_ingredientes: ProductIngredient[];
  compras: InventoryPurchase[];
  ventas: InventorySale[];
};
