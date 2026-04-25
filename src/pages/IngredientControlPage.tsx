import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  addPurchase,
  createNewIngredient,
  evaluateMenuIngredientAvailability,
  getLowStockIngredients,
  loadIngredientStore,
  menuProducts,
  saveIngredientStore,
} from "../data/ingredientStore";
import type {
  Ingredient,
  IngredientControlType,
  IngredientRelationType,
  IngredientStoreState,
  IngredientUnit,
  ProductIngredient,
  ProductIngredientStatus,
} from "../types/ingredients";
import { shellCardClass } from "../constants/app";

const relationLabels: Record<IngredientRelationType, string> = {
  obligatorio: "Obligatorio",
  opcional: "Opcional",
  reemplazable: "Reemplazable",
};

const statusLabels: Record<ProductIngredientStatus, string> = {
  bloqueado: "Bloqueado",
  advertencia: "Con advertencia",
  disponible: "Disponible",
};

const statusClasses: Record<ProductIngredientStatus, string> = {
  bloqueado: "border-red-200 bg-red-50 text-red-700",
  advertencia: "border-amber-200 bg-amber-50 text-amber-700",
  disponible: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
};

const relationOptions: IngredientRelationType[] = ["obligatorio", "opcional", "reemplazable"];
const controlTypeOptions: IngredientControlType[] = ["manual", "automatico"];
const unitOptions: IngredientUnit[] = ["manual", "unidad", "porcion", "gramos", "ml"];

const inputClass =
  "w-full rounded-[1.1rem] border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm outline-none transition focus:border-fuchsia-400 focus:bg-white";

const buttonClass =
  "rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-300/40 transition hover:bg-rose-600";

const ghostButtonClass =
  "rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50";

const getProductSummary = (count: number) => {
  if (count === 0) {
    return "Sin productos asociados";
  }

  if (count === 1) {
    return "1 producto afectado";
  }

  return `${count} productos afectados`;
};

const getRelationKey = (relation: ProductIngredient) => `${relation.producto_id}:${relation.ingrediente_id}`;

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex w-full items-center justify-between rounded-[1.2rem] border px-3 py-2 text-sm font-semibold sm:w-auto sm:min-w-38 ${
        checked
          ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      aria-pressed={checked}
    >
      <span>{checked ? "Disponible" : "Sin stock"}</span>
      <span
        className={`ml-3 h-6 w-11 rounded-full p-1 transition ${checked ? "bg-emerald-500" : "bg-red-400"}`}
        aria-hidden="true"
      >
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: ProductIngredientStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export function IngredientControlPage() {
  const [store, setStore] = useState<IngredientStoreState>({
    ingredientes: [],
    productos_ingredientes: [],
    compras: [],
    ventas: [],
  });
  const [newIngredientName, setNewIngredientName] = useState("");
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editingIngredientName, setEditingIngredientName] = useState("");
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>(menuProducts[0]?.id ?? "");
  const [selectedRelationType, setSelectedRelationType] = useState<IngredientRelationType>("obligatorio");
  const [selectedConsumption, setSelectedConsumption] = useState("");
  const [purchaseIngredientId, setPurchaseIngredientId] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"todos" | "manual" | "automatico" | "sin-stock" | "bajo-stock">("todos");
  const [statusFilter, setStatusFilter] = useState<ProductIngredientStatus | "todos">("todos");

  useEffect(() => {
    void loadIngredientStore().then((state) => {
      setStore(state);
      setSelectedIngredientId(state.ingredientes[0]?.id ?? "");
      setPurchaseIngredientId(state.ingredientes[0]?.id ?? "");
    });
  }, []);

  useEffect(() => {
    void saveIngredientStore(store);
  }, [store]);

  const productById = useMemo(() => new Map(menuProducts.map((product) => [product.id, product])), []);
  const ingredientById = useMemo(
    () => new Map(store.ingredientes.map((ingredient) => [ingredient.id, ingredient])),
    [store.ingredientes],
  );

  const evaluations = useMemo(() => evaluateMenuIngredientAvailability(store), [store]);

  const summary = useMemo(
    () => ({
      bloqueados: evaluations.filter((item) => item.status === "bloqueado").length,
      advertencias: evaluations.filter((item) => item.status === "advertencia").length,
      disponibles: evaluations.filter((item) => item.status === "disponible").length,
    }),
    [evaluations],
  );

  const lowStockIngredients = useMemo(() => getLowStockIngredients(store), [store]);

  const relationsByIngredient = useMemo(() => {
    const groups = new Map<string, ProductIngredient[]>();

    for (const relation of store.productos_ingredientes) {
      const current = groups.get(relation.ingrediente_id) ?? [];
      current.push(relation);
      groups.set(relation.ingrediente_id, current);
    }

    return groups;
  }, [store.productos_ingredientes]);

  const selectedIngredient = selectedIngredientId ? ingredientById.get(selectedIngredientId) : undefined;
  const selectedIngredientRelations = selectedIngredientId ? relationsByIngredient.get(selectedIngredientId) ?? [] : [];

  const filteredIngredients = useMemo(() => {
    const query = ingredientQuery.trim().toLowerCase();

    return store.ingredientes.filter((ingredient) => {
      const stock = ingredient.stock_actual ?? 0;
      const isLowStock = ingredient.tipo_control === "automatico" && ingredient.stock_minimo !== null && stock > 0 && stock <= ingredient.stock_minimo;
      const matchesFilter =
        inventoryFilter === "todos" ||
        ingredient.tipo_control === inventoryFilter ||
        (inventoryFilter === "sin-stock" && !ingredient.disponible) ||
        (inventoryFilter === "bajo-stock" && isLowStock);

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const products = relationsByIngredient.get(ingredient.id) ?? [];
      return (
        ingredient.nombre.toLowerCase().includes(query) ||
        products.some((relation) => productById.get(relation.producto_id)?.nombre.toLowerCase().includes(query))
      );
    });
  }, [ingredientQuery, inventoryFilter, productById, relationsByIngredient, store.ingredientes]);

  const filteredEvaluations = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    return evaluations.filter((evaluation) => {
      const matchesStatus = statusFilter === "todos" || evaluation.status === statusFilter;
      const matchesQuery =
        !query ||
        evaluation.product.nombre.toLowerCase().includes(query) ||
        evaluation.product.categoria.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [evaluations, productQuery, statusFilter]);

  const addIngredient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nombre = newIngredientName.trim();

    if (!nombre) {
      return;
    }

    const ingredient = createNewIngredient(nombre, store.ingredientes);

    setStore((current) => ({
      ...current,
      ingredientes: [...current.ingredientes, ingredient].sort((first, second) =>
        first.nombre.localeCompare(second.nombre, "es"),
      ),
    }));
    setNewIngredientName("");
    setSelectedIngredientId(ingredient.id);
    setPurchaseIngredientId(ingredient.id);
  };

  const updateIngredient = (id: string, updates: Partial<Ingredient>) => {
    setStore((current) => ({
      ...current,
      ingredientes: current.ingredientes.map((ingredient) => {
        if (ingredient.id !== id) {
          return ingredient;
        }

        const next = { ...ingredient, ...updates };

        if (updates.tipo_control === "manual") {
          next.unidad = "manual";
          next.stock_actual = null;
          next.stock_minimo = null;
        }

        if (updates.tipo_control === "automatico" && ingredient.tipo_control === "manual") {
          next.unidad = "unidad";
          next.stock_actual = 0;
          next.stock_minimo = 5;
          next.disponible = false;
        }

        if (next.tipo_control === "automatico") {
          next.disponible = (next.stock_actual ?? 0) > 0 && next.disponible;
        }

        return next;
      }),
    }));
  };

  const toggleIngredientAvailability = (id: string) => {
    setStore((current) => ({
      ...current,
      ingredientes: current.ingredientes.map((ingredient) =>
        ingredient.id === id
          ? {
              ...ingredient,
              disponible:
                ingredient.tipo_control === "automatico" && (ingredient.stock_actual ?? 0) <= 0
                  ? false
                  : !ingredient.disponible,
            }
          : ingredient,
      ),
    }));
  };

  const startEditIngredient = (ingredient: Ingredient) => {
    setEditingIngredientId(ingredient.id);
    setEditingIngredientName(ingredient.nombre);
  };

  const saveIngredientName = (id: string) => {
    const nombre = editingIngredientName.trim();

    if (!nombre) {
      return;
    }

    setStore((current) => ({
      ...current,
      ingredientes: current.ingredientes
        .map((ingredient) => (ingredient.id === id ? { ...ingredient, nombre } : ingredient))
        .sort((first, second) => first.nombre.localeCompare(second.nombre, "es")),
    }));
    setEditingIngredientId(null);
    setEditingIngredientName("");
  };

  const deleteIngredient = (ingredient: Ingredient) => {
    const confirmed = window.confirm(`Eliminar "${ingredient.nombre}" tambien quitara sus asociaciones con productos.`);

    if (!confirmed) {
      return;
    }

    setStore((current) => ({
      ...current,
      ingredientes: current.ingredientes.filter((item) => item.id !== ingredient.id),
      productos_ingredientes: current.productos_ingredientes.filter((relation) => relation.ingrediente_id !== ingredient.id),
    }));

    if (selectedIngredientId === ingredient.id) {
      const nextIngredient = store.ingredientes.find((item) => item.id !== ingredient.id);
      setSelectedIngredientId(nextIngredient?.id ?? "");
    }
  };

  const addRelation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedIngredientId || !selectedProductId) {
      return;
    }

    const nextRelation: ProductIngredient = {
      producto_id: selectedProductId,
      ingrediente_id: selectedIngredientId,
      tipo: selectedRelationType,
      cantidad_consumida: selectedConsumption.trim() ? Number(selectedConsumption) : null,
    };

    setStore((current) => {
      const exists = current.productos_ingredientes.some((relation) => getRelationKey(relation) === getRelationKey(nextRelation));

      if (exists) {
        return {
          ...current,
          productos_ingredientes: current.productos_ingredientes.map((relation) =>
            getRelationKey(relation) === getRelationKey(nextRelation) ? nextRelation : relation,
          ),
        };
      }

      return {
        ...current,
        productos_ingredientes: [...current.productos_ingredientes, nextRelation],
      };
    });
  };

  const updateRelationType = (relation: ProductIngredient, tipo: IngredientRelationType) => {
    setStore((current) => ({
      ...current,
      productos_ingredientes: current.productos_ingredientes.map((item) =>
        getRelationKey(item) === getRelationKey(relation) ? { ...item, tipo } : item,
      ),
    }));
  };

  const updateRelationConsumption = (relation: ProductIngredient, value: string) => {
    const cantidad_consumida = value.trim() ? Number(value) : null;

    setStore((current) => ({
      ...current,
      productos_ingredientes: current.productos_ingredientes.map((item) =>
        getRelationKey(item) === getRelationKey(relation) ? { ...item, cantidad_consumida } : item,
      ),
    }));
  };

  const handlePurchaseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ingredient = ingredientById.get(purchaseIngredientId);

    if (!ingredient) {
      return;
    }

    const quantity = ingredient.tipo_control === "automatico" ? Number(purchaseQuantity) : 0;

    if (ingredient.tipo_control === "automatico" && (!Number.isFinite(quantity) || quantity <= 0)) {
      window.alert("Ingresa una cantidad comprada mayor a 0 para ingredientes automaticos.");
      return;
    }

    setStore((current) =>
      addPurchase(current, {
        fecha: purchaseDate,
        ingrediente_id: ingredient.id,
        cantidad: ingredient.tipo_control === "automatico" ? quantity : 0,
        costo_total: purchaseCost.trim() ? Number(purchaseCost) : undefined,
      }),
    );
    setPurchaseQuantity("");
    setPurchaseCost("");
  };

  const deleteRelation = (relation: ProductIngredient) => {
    setStore((current) => ({
      ...current,
      productos_ingredientes: current.productos_ingredientes.filter((item) => getRelationKey(item) !== getRelationKey(relation)),
    }));
  };

  const renderProductNames = (relations: ProductIngredient[]) => {
    if (relations.length === 0) {
      return <span className="text-sm text-rose-500">Sin productos vinculados</span>;
    }

    return relations.slice(0, 3).map((relation) => productById.get(relation.producto_id)?.nombre).filter(Boolean).join(", ");
  };

  return (
    <section id="control-ingredientes" className="flex h-full min-h-0 flex-col space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <article className={`${shellCardClass} md:col-span-2`}>
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">
            Admin
          </span>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-rose-950 sm:text-3xl">Control de ingredientes</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-700/80">
                Activa o pausa ingredientes manualmente y define que productos del menu dependen de cada uno.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[1.2rem] border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                <p className="text-lg font-black">{summary.bloqueados}</p>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em]">Bloqueados</p>
              </div>
              <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                <p className="text-lg font-black">{summary.advertencias}</p>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em]">Avisos</p>
              </div>
              <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-700">
                <p className="text-lg font-black">{summary.disponibles}</p>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em]">Ok</p>
              </div>
            </div>
          </div>
          {lowStockIngredients.length > 0 ? (
            <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Bajo stock: {lowStockIngredients.map((ingredient) => ingredient.nombre).join(", ")}
            </div>
          ) : null}
        </article>

        <form className={`${shellCardClass} space-y-3`} onSubmit={addIngredient}>
          <div>
            <h3 className="text-lg font-bold text-rose-950">Agregar ingrediente</h3>
            <p className="text-sm text-rose-700/80">Queda disponible para asociarlo al menu.</p>
          </div>
          <input
            value={newIngredientName}
            onChange={(event) => setNewIngredientName(event.target.value)}
            className={inputClass}
            placeholder="Ej: Pepinillos"
          />
          <button type="submit" className={`${buttonClass} w-full`}>
            Agregar
          </button>
        </form>
      </div>

      <article className={`${shellCardClass} space-y-4`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-rose-950">Ingresar compra</h3>
            <p className="text-sm text-rose-700/80">Las compras automaticas suman stock. Las manuales solo marcan disponible.</p>
          </div>
          <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
            {store.compras.length} compras
          </span>
        </div>
        <form className="grid gap-3 lg:grid-cols-[1fr_0.8fr_0.7fr_0.7fr_auto]" onSubmit={handlePurchaseSubmit}>
          <select value={purchaseIngredientId} onChange={(event) => setPurchaseIngredientId(event.target.value)} className={inputClass}>
            {store.ingredientes.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.nombre} · {ingredient.tipo_control}
              </option>
            ))}
          </select>
          <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className={inputClass} />
          <input
            type="number"
            min="0"
            step="0.01"
            value={purchaseQuantity}
            onChange={(event) => setPurchaseQuantity(event.target.value)}
            className={inputClass}
            placeholder="Cantidad"
            disabled={ingredientById.get(purchaseIngredientId)?.tipo_control === "manual"}
          />
          <input
            type="number"
            min="0"
            step="1"
            value={purchaseCost}
            onChange={(event) => setPurchaseCost(event.target.value)}
            className={inputClass}
            placeholder="Costo total"
          />
          <button type="submit" className={buttonClass}>
            Guardar
          </button>
        </form>
      </article>

      <div className="min-h-0 flex-1 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-rose-950">Ingredientes</h3>
              <p className="text-sm text-rose-700/80">Stock manual y productos afectados.</p>
            </div>
            <input
              value={ingredientQuery}
              onChange={(event) => setIngredientQuery(event.target.value)}
              className={`${inputClass} sm:max-w-64`}
              placeholder="Buscar ingrediente"
            />
            <select
              value={inventoryFilter}
              onChange={(event) => setInventoryFilter(event.target.value as typeof inventoryFilter)}
              className={`${inputClass} sm:max-w-48`}
            >
              <option value="todos">Todos</option>
              <option value="manual">Manual</option>
              <option value="automatico">Automatico</option>
              <option value="sin-stock">Sin stock</option>
              <option value="bajo-stock">Bajo stock</option>
            </select>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {filteredIngredients.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-rose-200 bg-rose-50/60 p-6 text-center text-sm font-semibold text-rose-600">
                No hay ingredientes que coincidan con la busqueda.
              </div>
            ) : (
              filteredIngredients.map((ingredient) => {
                const relations = relationsByIngredient.get(ingredient.id) ?? [];
                const isSelected = selectedIngredientId === ingredient.id;

                return (
                  <div
                    key={ingredient.id}
                    className={`rounded-[1.5rem] border p-4 transition ${
                      isSelected ? "border-fuchsia-200 bg-white shadow-sm" : "border-rose-100 bg-rose-50/60"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {editingIngredientId === ingredient.id ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={editingIngredientName}
                              onChange={(event) => setEditingIngredientName(event.target.value)}
                              className={inputClass}
                              autoFocus
                            />
                            <button type="button" onClick={() => saveIngredientName(ingredient.id)} className={ghostButtonClass}>
                              Guardar
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedIngredientId(ingredient.id)}
                              className="text-left text-lg font-black text-rose-950 hover:text-fuchsia-700"
                            >
                              {ingredient.nombre}
                            </button>
                            <p className="mt-1 text-sm text-rose-700/80">{getProductSummary(relations.length)}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em]">
                              <span className="rounded-full bg-white px-3 py-1 text-fuchsia-700">{ingredient.tipo_control}</span>
                              <span className="rounded-full bg-white px-3 py-1 text-rose-600">{ingredient.unidad}</span>
                              {ingredient.tipo_control === "automatico" ? (
                                <span className="rounded-full bg-white px-3 py-1 text-rose-900">
                                  Stock: {ingredient.stock_actual ?? 0}
                                </span>
                              ) : null}
                              {ingredient.tipo_control === "automatico" && ingredient.stock_minimo !== null && (ingredient.stock_actual ?? 0) <= ingredient.stock_minimo ? (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Bajo stock</span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-rose-600">{renderProductNames(relations)}</p>
                          </>
                        )}
                      </div>
                      <ToggleSwitch checked={ingredient.disponible} onChange={() => toggleIngredientAvailability(ingredient.id)} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <select
                        value={ingredient.tipo_control}
                        onChange={(event) => updateIngredient(ingredient.id, { tipo_control: event.target.value as IngredientControlType })}
                        className="rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 outline-none"
                      >
                        {controlTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ingredient.unidad}
                        onChange={(event) => updateIngredient(ingredient.id, { unidad: event.target.value as IngredientUnit })}
                        className="rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 outline-none"
                        disabled={ingredient.tipo_control === "manual"}
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                      {ingredient.tipo_control === "automatico" ? (
                        <input
                          type="number"
                          min="0"
                          value={ingredient.stock_minimo ?? ""}
                          onChange={(event) => updateIngredient(ingredient.id, { stock_minimo: Number(event.target.value) })}
                          className="w-28 rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 outline-none"
                          placeholder="Minimo"
                          aria-label={`Stock minimo de ${ingredient.nombre}`}
                        />
                      ) : null}
                      <button type="button" onClick={() => setSelectedIngredientId(ingredient.id)} className={ghostButtonClass}>
                        Asociar
                      </button>
                      <button type="button" onClick={() => startEditIngredient(ingredient)} className={ghostButtonClass}>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteIngredient(ingredient)}
                        className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
          <article className={`${shellCardClass} space-y-4`}>
            <div>
              <h3 className="text-xl font-bold text-rose-950">Asociaciones</h3>
              <p className="text-sm text-rose-700/80">
                {selectedIngredient ? `Editando dependencias de ${selectedIngredient.nombre}.` : "Selecciona un ingrediente."}
              </p>
            </div>

            <form className="grid gap-3 lg:grid-cols-[1fr_0.8fr_auto]" onSubmit={addRelation}>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className={inputClass}
                disabled={!selectedIngredient}
              >
                {menuProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.nombre}
                  </option>
                ))}
              </select>
              <select
                value={selectedRelationType}
                onChange={(event) => setSelectedRelationType(event.target.value as IngredientRelationType)}
                className={inputClass}
                disabled={!selectedIngredient}
              >
                {relationOptions.map((type) => (
                  <option key={type} value={type}>
                    {relationLabels[type]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={selectedConsumption}
                onChange={(event) => setSelectedConsumption(event.target.value)}
                className={inputClass}
                placeholder="Consumo"
                disabled={!selectedIngredient || selectedIngredient.tipo_control === "manual"}
              />
              <button type="submit" className={buttonClass} disabled={!selectedIngredient}>
                Vincular
              </button>
            </form>

            <div className="max-h-56 space-y-2 overflow-auto pr-1">
              {selectedIngredientRelations.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm font-semibold text-rose-600">
                  Este ingrediente aun no tiene productos asociados.
                </div>
              ) : (
                selectedIngredientRelations.map((relation) => {
                  const product = productById.get(relation.producto_id);

                  if (!product) {
                    return null;
                  }

                  return (
                    <div key={getRelationKey(relation)} className="flex flex-col gap-3 rounded-[1.3rem] border border-rose-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-rose-950">{product.nombre}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">{product.categoria}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={relation.tipo}
                          onChange={(event) => updateRelationType(relation, event.target.value as IngredientRelationType)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 outline-none"
                        >
                          {relationOptions.map((type) => (
                            <option key={type} value={type}>
                              {relationLabels[type]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={relation.cantidad_consumida ?? ""}
                          onChange={(event) => updateRelationConsumption(relation, event.target.value)}
                          className="w-28 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 outline-none"
                          placeholder="Consumo"
                          disabled={ingredientById.get(relation.ingrediente_id)?.tipo_control === "manual"}
                        />
                        <button
                          type="button"
                          onClick={() => deleteRelation(relation)}
                          className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-rose-950">Estado del menu</h3>
                <p className="text-sm text-rose-700/80">Vista previa preparada para el menu publico.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ProductIngredientStatus | "todos")}
                  className={inputClass}
                >
                  <option value="todos">Todos</option>
                  <option value="bloqueado">Bloqueados</option>
                  <option value="advertencia">Con advertencia</option>
                  <option value="disponible">Disponibles</option>
                </select>
                <input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  className={inputClass}
                  placeholder="Buscar producto"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
              {filteredEvaluations.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-rose-200 bg-rose-50/60 p-6 text-center text-sm font-semibold text-rose-600">
                  No hay productos para el filtro seleccionado.
                </div>
              ) : (
                filteredEvaluations.map((evaluation) => (
                  <div key={evaluation.product.id} className="rounded-[1.5rem] border border-rose-100 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black text-rose-950">{evaluation.product.nombre}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">
                          {evaluation.product.categoria}
                        </p>
                      </div>
                      <StatusBadge status={evaluation.status} />
                    </div>

                    {evaluation.status !== "disponible" ? (
                      <div className="mt-3 space-y-1 text-sm text-rose-700">
                        {evaluation.blockingIngredients.length > 0 ? (
                          <p>
                            Bloquea:{" "}
                            <span className="font-bold">
                              {evaluation.blockingIngredients.map((ingredient) => ingredient.nombre).join(", ")}
                            </span>
                          </p>
                        ) : null}
                        {evaluation.warningIngredients.length > 0 ? (
                          <p>
                            Advierte:{" "}
                            <span className="font-bold">
                              {evaluation.warningIngredients.map((ingredient) => ingredient.nombre).join(", ")}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm font-semibold text-emerald-700">Sin ingredientes faltantes.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
