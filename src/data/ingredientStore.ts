import { orderMenuCategories, orderMenuItems, sideSauceOptions, type OrderMenuItem } from "./order-menu";
import type {
  Ingredient,
  IngredientControlType,
  IngredientRelationType,
  IngredientStoreState,
  IngredientUnit,
  InventoryPurchase,
  InventorySale,
  InventorySaleInputItem,
  InventoryValidationResult,
  MenuProductReference,
  ProductIngredient,
  ProductIngredientEvaluation,
  ProductIngredientStatus,
} from "../types/inventory";

const STORAGE_KEY = "pink-finance-studio:ingredient-control";

const automaticIngredientNames = new Set([
  "Pan",
  "Carne",
  "Papitas fritas",
  "Bebida",
  "Sprite",
  "Coca-Cola",
  "Fanta",
  "Nuggets",
]);

const manualIngredientHints = ["salsa", "mayonesa", "ketchup", "mostaza", "bbq", "chick", "tomate", "lechuga", "cebolla", "palta", "queso", "cheddar", "tocino", "huevo", "aderezo"];

export const createStableId = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const createProductId = (item: Pick<OrderMenuItem, "name" | "category">) => `${item.category}:${createStableId(item.name)}`;

const categoryLabelById = new Map(orderMenuCategories.map((category) => [category.id, category.label]));

export const menuProducts: MenuProductReference[] = orderMenuItems.map((item) => ({
  id: createProductId(item),
  nombre: item.name,
  categoria: categoryLabelById.get(item.category) ?? item.category,
}));

const menuProductByName = new Map(menuProducts.map((product) => [createStableId(product.nombre), product]));

const getControlType = (name: string): IngredientControlType => {
  if (automaticIngredientNames.has(name)) {
    return "automatico";
  }

  const normalized = createStableId(name);
  return manualIngredientHints.some((hint) => normalized.includes(createStableId(hint))) ? "manual" : "manual";
};

const getUnit = (name: string, controlType: IngredientControlType): IngredientUnit => {
  if (controlType === "manual") {
    return "manual";
  }

  if (name === "Papitas fritas") {
    return "porcion";
  }

  return "unidad";
};

const getInitialStockMinimum = (name: string, controlType: IngredientControlType) => {
  if (controlType === "manual") {
    return null;
  }

  if (name === "Papitas fritas") {
    return 10;
  }

  if (name === "Bebida" || name === "Sprite" || name === "Coca-Cola" || name === "Fanta") {
    return 6;
  }

  return 5;
};

const createIngredient = (nombre: string): Ingredient => {
  const tipo_control = getControlType(nombre);
  return {
    id: createStableId(nombre),
    nombre,
    disponible: tipo_control === "manual",
    tipo_control,
    unidad: getUnit(nombre, tipo_control),
    stock_actual: tipo_control === "automatico" ? 0 : null,
    stock_minimo: getInitialStockMinimum(nombre, tipo_control),
  };
};

const baseIngredientsByCategory = (item: OrderMenuItem): string[] => {
  if (item.category === "burgers") {
    return ["Pan", "Carne"];
  }

  if (item.category === "individual-combos") {
    return ["Pan", "Carne", "Papitas fritas", "Bebida"];
  }

  if (item.category === "family-combos") {
    return ["Pan", "Carne", "Papitas fritas"];
  }

  if (item.category === "papero-combo") {
    return ["Pan", "Carne", "Papitas fritas"];
  }

  if (item.category === "sides") {
    if (item.name === "Papitas fritas") {
      return ["Papitas fritas"];
    }

    if (item.name === "Bebida") {
      return ["Bebida"];
    }

    if (item.name.toLowerCase().includes("nuggets")) {
      return ["Nuggets"];
    }
  }

  if (item.category === "sauces") {
    return [item.name];
  }

  return [];
};

const getDefaultConsumption = (ingredientName: string, product: OrderMenuItem) => {
  if (!automaticIngredientNames.has(ingredientName)) {
    return null;
  }

  if (ingredientName === "Pan" || ingredientName === "Carne") {
    if (product.category === "family-combos") {
      return 5;
    }

    if (product.category === "burgers" || product.category === "individual-combos" || product.category === "papero-combo") {
      return 1;
    }
  }

  if (ingredientName === "Bebida" || ingredientName === "Papitas fritas") {
    return 1;
  }

  if (ingredientName === "Sprite" || ingredientName === "Coca-Cola" || ingredientName === "Fanta") {
    return 1;
  }

  if (ingredientName === "Nuggets") {
    return product.name.includes("10") ? 10 : 5;
  }

  return 1;
};

const pushRelation = (
  relations: ProductIngredient[],
  seen: Set<string>,
  product: OrderMenuItem,
  ingredientName: string,
  tipo: IngredientRelationType,
) => {
  const producto_id = createProductId(product);
  const ingrediente_id = createStableId(ingredientName);
  const key = `${producto_id}:${ingrediente_id}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  relations.push({
    producto_id,
    ingrediente_id,
    tipo,
    cantidad_consumida: getDefaultConsumption(ingredientName, product),
  });
};

const createInitialState = (): IngredientStoreState => {
  const ingredientNames = new Set<string>();
  const productos_ingredientes: ProductIngredient[] = [];
  const seenRelations = new Set<string>();

  for (const item of orderMenuItems) {
    for (const name of baseIngredientsByCategory(item)) {
      ingredientNames.add(name);
      pushRelation(productos_ingredientes, seenRelations, item, name, "obligatorio");
    }

    for (const name of item.removableIngredients ?? []) {
      ingredientNames.add(name);
      pushRelation(productos_ingredientes, seenRelations, item, name, "obligatorio");
    }

    for (const name of item.drinkOptions ?? []) {
      ingredientNames.add(name);
      pushRelation(productos_ingredientes, seenRelations, item, name, "reemplazable");
    }

    for (const name of item.sauceOptions ?? []) {
      ingredientNames.add(name);
      pushRelation(productos_ingredientes, seenRelations, item, name, "opcional");
    }
  }

  const ingredientes = [...ingredientNames].sort((first, second) => first.localeCompare(second, "es")).map(createIngredient);

  return { ingredientes, productos_ingredientes, compras: [], ventas: [] };
};

const migrateIngredient = (ingredient: Partial<Ingredient> & Pick<Ingredient, "id" | "nombre" | "disponible">): Ingredient => {
  const tipo_control = ingredient.tipo_control ?? getControlType(ingredient.nombre);
  const stock_actual = tipo_control === "automatico" ? ingredient.stock_actual ?? 0 : null;

  return {
    id: ingredient.id,
    nombre: ingredient.nombre,
    disponible: tipo_control === "automatico" ? (stock_actual ?? 0) > 0 && ingredient.disponible : ingredient.disponible,
    tipo_control,
    unidad: ingredient.unidad ?? getUnit(ingredient.nombre, tipo_control),
    stock_actual,
    stock_minimo: tipo_control === "automatico" ? ingredient.stock_minimo ?? getInitialStockMinimum(ingredient.nombre, tipo_control) : null,
  };
};

const normalizeState = (state: IngredientStoreState): IngredientStoreState => {
  const ingredientes = state.ingredientes
    .map(migrateIngredient)
    .sort((first, second) => first.nombre.localeCompare(second.nombre, "es"));
  const ingredientIds = new Set(ingredientes.map((ingredient) => ingredient.id));
  const productIds = new Set(menuProducts.map((product) => product.id));
  const familyComboDrinkIds = new Set(["Bebida", "Sprite", "Coca-Cola", "Fanta"].map(createStableId));

  return {
    ingredientes,
    productos_ingredientes: state.productos_ingredientes
      .filter((relation) => ingredientIds.has(relation.ingrediente_id) && productIds.has(relation.producto_id))
      .filter(
        (relation) => !(relation.producto_id.startsWith("family-combos:") && familyComboDrinkIds.has(relation.ingrediente_id)),
      )
      .map((relation) => ({
        ...relation,
        cantidad_consumida:
          relation.producto_id.startsWith("family-combos:") &&
          (relation.ingrediente_id === createStableId("Pan") || relation.ingrediente_id === createStableId("Carne"))
            ? 5
            : relation.cantidad_consumida ?? null,
      })),
    compras: state.compras ?? [],
    ventas: state.ventas ?? [],
  };
};

export const defaultIngredientStoreState = createInitialState();

export const loadIngredientStore = async (): Promise<IngredientStoreState> => {
  if (typeof window === "undefined") {
    return defaultIngredientStoreState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw) as IngredientStoreState) : defaultIngredientStoreState;
  } catch {
    return defaultIngredientStoreState;
  }
};

export const saveIngredientStore = async (state: IngredientStoreState) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
};

export const createIngredientId = (nombre: string, existingIngredients: Ingredient[]) => {
  const baseId = createStableId(nombre) || `ingrediente-${Date.now()}`;
  let id = baseId;
  let counter = 2;

  while (existingIngredients.some((ingredient) => ingredient.id === id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  return id;
};

export const getIngredientAvailability = (ingredient: Ingredient) => {
  if (ingredient.tipo_control === "automatico") {
    const stock = ingredient.stock_actual ?? 0;
    return {
      disponible: ingredient.disponible && stock > 0,
      bajoStock: ingredient.stock_minimo !== null && stock > 0 && stock <= ingredient.stock_minimo,
    };
  }

  return {
    disponible: ingredient.disponible,
    bajoStock: false,
  };
};

const shouldApplyRelationToSaleItem = (
  state: IngredientStoreState,
  relation: ProductIngredient,
  saleItem: InventorySaleInputItem,
) => {
  const ingredient = state.ingredientes.find((item) => item.id === relation.ingrediente_id);

  if (!ingredient) {
    return false;
  }

  if (saleItem.removedIngredients?.some((name) => createStableId(name) === createStableId(ingredient.nombre))) {
    return false;
  }

  if (saleItem.drink && relation.tipo === "reemplazable" && ["Sprite", "Coca-Cola", "Fanta"].includes(ingredient.nombre)) {
    return createStableId(saleItem.drink) === createStableId(ingredient.nombre);
  }

  if (saleItem.sauce && sideSauceOptions.some((name) => createStableId(name) === createStableId(ingredient.nombre))) {
    return createStableId(saleItem.sauce) === createStableId(ingredient.nombre);
  }

  return true;
};

const getProductRelationsForSaleItem = (state: IngredientStoreState, saleItem: InventorySaleInputItem) => {
  const product = saleItem.productId
    ? menuProducts.find((item) => item.id === saleItem.productId)
    : menuProductByName.get(createStableId(saleItem.productName));

  if (!product) {
    return [];
  }

  return state.productos_ingredientes
    .filter((relation) => relation.producto_id === product.id)
    .filter((relation) => shouldApplyRelationToSaleItem(state, relation, saleItem));
};

export const validateSaleAgainstInventory = (
  state: IngredientStoreState,
  saleItems: InventorySaleInputItem[],
): InventoryValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const saleItem of saleItems) {
    const product = saleItem.productId
      ? menuProducts.find((item) => item.id === saleItem.productId)
      : menuProductByName.get(createStableId(saleItem.productName));

    if (!product) {
      continue;
    }

    for (const relation of getProductRelationsForSaleItem(state, saleItem)) {
      const ingredient = state.ingredientes.find((item) => item.id === relation.ingrediente_id);

      if (!ingredient) {
        continue;
      }

      const needed = (relation.cantidad_consumida ?? 0) * saleItem.quantity;
      const availability = getIngredientAvailability(ingredient);
      const missingAutomatic = ingredient.tipo_control === "automatico" && needed > (ingredient.stock_actual ?? 0);
      const missingManual = ingredient.tipo_control === "manual" && !availability.disponible;

      if (relation.tipo === "obligatorio" && (missingAutomatic || missingManual)) {
        errors.push(`${product.nombre}: falta ${ingredient.nombre}`);
      } else if ((relation.tipo === "opcional" || relation.tipo === "reemplazable") && (missingAutomatic || missingManual)) {
        warnings.push(`${product.nombre}: ${ingredient.nombre} no disponible`);
      }
    }
  }

  return {
    canSell: errors.length === 0,
    errors,
    warnings,
  };
};

export const decrementInventoryForSale = (state: IngredientStoreState, saleItems: InventorySaleInputItem[]) => {
  const consumption = new Map<string, number>();

  for (const saleItem of saleItems) {
    for (const relation of getProductRelationsForSaleItem(state, saleItem)) {
      const ingredient = state.ingredientes.find((item) => item.id === relation.ingrediente_id);

      if (!ingredient || ingredient.tipo_control !== "automatico") {
        continue;
      }

      const amount = (relation.cantidad_consumida ?? 0) * saleItem.quantity;
      consumption.set(ingredient.id, (consumption.get(ingredient.id) ?? 0) + amount);
    }
  }

  return {
    ...state,
    ingredientes: state.ingredientes.map((ingredient) => {
      const amount = consumption.get(ingredient.id) ?? 0;

      if (amount <= 0 || ingredient.tipo_control !== "automatico") {
        return ingredient;
      }

      const nextStock = Math.max(0, (ingredient.stock_actual ?? 0) - amount);
      return {
        ...ingredient,
        stock_actual: nextStock,
        disponible: nextStock > 0,
      };
    }),
  };
};

export const addPurchase = (
  state: IngredientStoreState,
  payload: { fecha: string; ingrediente_id: string; cantidad: number; costo_total?: number },
): IngredientStoreState => {
  const compraId = crypto.randomUUID();
  const purchase: InventoryPurchase = {
    id: compraId,
    fecha: payload.fecha,
    items: [
      {
        id: crypto.randomUUID(),
        compra_id: compraId,
        ingrediente_id: payload.ingrediente_id,
        cantidad: payload.cantidad,
        costo_total: payload.costo_total,
      },
    ],
  };

  return {
    ...state,
    compras: [purchase, ...state.compras],
    ingredientes: state.ingredientes.map((ingredient) => {
      if (ingredient.id !== payload.ingrediente_id) {
        return ingredient;
      }

      if (ingredient.tipo_control === "manual") {
        return { ...ingredient, disponible: true };
      }

      const nextStock = (ingredient.stock_actual ?? 0) + payload.cantidad;
      return {
        ...ingredient,
        stock_actual: nextStock,
        disponible: nextStock > 0,
      };
    }),
  };
};

export const updateIngredientAvailability = (
  state: IngredientStoreState,
  ingredientId: string,
  disponible: boolean,
): IngredientStoreState => ({
  ...state,
  ingredientes: state.ingredientes.map((ingredient) =>
    ingredient.id === ingredientId ? { ...ingredient, disponible } : ingredient,
  ),
});

export const registerSale = (
  state: IngredientStoreState,
  payload: { ventaId?: string; fecha: string; items: InventorySaleInputItem[] },
) => {
  const validation = validateSaleAgainstInventory(state, payload.items);

  if (!validation.canSell) {
    return { state, validation };
  }

  const ventaId = payload.ventaId ?? crypto.randomUUID();
  const nextState = decrementInventoryForSale(state, payload.items);
  const sale: InventorySale = {
    id: ventaId,
    fecha: payload.fecha,
    items: payload.items.map((item) => ({
      id: crypto.randomUUID(),
      venta_id: ventaId,
      producto_id: item.productId ?? menuProductByName.get(createStableId(item.productName))?.id ?? createStableId(item.productName),
      cantidad: item.quantity,
    })),
  };

  return {
    state: {
      ...nextState,
      ventas: [sale, ...nextState.ventas],
    },
    validation,
  };
};

export const getLowStockIngredients = (state: IngredientStoreState) =>
  state.ingredientes.filter((ingredient) => {
    if (ingredient.tipo_control !== "automatico" || ingredient.stock_minimo === null) {
      return false;
    }

    const stock = ingredient.stock_actual ?? 0;
    return stock > 0 && stock <= ingredient.stock_minimo;
  });

export const evaluateProductIngredientAvailability = (
  state: IngredientStoreState,
  product: MenuProductReference,
): ProductIngredientEvaluation => {
  const relations = state.productos_ingredientes.filter((relation) => relation.producto_id === product.id);
  const ingredientById = new Map(state.ingredientes.map((ingredient) => [ingredient.id, ingredient]));
  const unavailableRelations = relations
    .map((relation) => ({ relation, ingredient: ingredientById.get(relation.ingrediente_id) }))
    .filter((item): item is { relation: ProductIngredient; ingredient: Ingredient } => Boolean(item.ingredient))
    .filter(({ ingredient }) => !getIngredientAvailability(ingredient).disponible);

  const blockingIngredients = unavailableRelations
    .filter(({ relation }) => relation.tipo === "obligatorio")
    .map(({ ingredient }) => ingredient);
  const warningIngredients = unavailableRelations
    .filter(({ relation }) => relation.tipo === "opcional" || relation.tipo === "reemplazable")
    .map(({ ingredient }) => ingredient);

  let status: ProductIngredientStatus = "disponible";

  if (blockingIngredients.length > 0) {
    status = "bloqueado";
  } else if (warningIngredients.length > 0) {
    status = "advertencia";
  }

  return {
    product,
    status,
    blockingIngredients,
    warningIngredients,
  };
};

export const getProductAvailability = (state: IngredientStoreState, productId: string) => {
  const product = menuProducts.find((item) => item.id === productId);
  return product ? evaluateProductIngredientAvailability(state, product) : null;
};

export const evaluateMenuIngredientAvailability = (state: IngredientStoreState) =>
  menuProducts.map((product) => evaluateProductIngredientAvailability(state, product));

export const createNewIngredient = (nombre: string, existingIngredients: Ingredient[]): Ingredient => {
  const tipo_control = getControlType(nombre);
  return {
    id: createIngredientId(nombre, existingIngredients),
    nombre,
    disponible: tipo_control === "manual",
    tipo_control,
    unidad: getUnit(nombre, tipo_control),
    stock_actual: tipo_control === "automatico" ? 0 : null,
    stock_minimo: getInitialStockMinimum(nombre, tipo_control),
  };
};
