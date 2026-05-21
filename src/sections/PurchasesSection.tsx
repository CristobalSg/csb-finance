import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DotsIcon } from "../components/icons";
import { PaginationControls } from "../components/common/PaginationControls";
import { TableEmpty } from "../components/common/TableEmpty";
import {
  movementCategoriesByType,
  movementCategoryLabels,
  movementPaymentMethodLabels,
  movementTypeLabels,
  purchaseItemTypeLabels,
  shellCardClass,
  type PurchaseFormState,
} from "../constants/app";
import { formatShortDate } from "../lib/date";
import { formatCurrency, formatNumber } from "../lib/format";
import type { InventoryItem, MovementCategory, MovementType, Purchase } from "../types";

const HISTORY_PAGE_SIZE = 8;
const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

export function PurchasesSection({
  loading,
  purchases,
  inventory,
  form,
  onChange,
  previewTotal,
  isEditing,
  onSubmit,
  onEdit,
  onCancelEdit,
  onDelete,
  onExport,
  onImport,
}: {
  loading: boolean;
  purchases: Purchase[];
  inventory: InventoryItem[];
  form: PurchaseFormState;
  onChange: (updater: (current: PurchaseFormState) => PurchaseFormState) => void;
  previewTotal: number;
  isEditing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (purchase: Purchase) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (csvContent: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<MovementCategory | "all">("all");
  const [actionsPurchaseId, setActionsPurchaseId] = useState<string | null>(null);
  const categoryOptions = movementCategoriesByType[form.type];

  const filterCategoryOptions = useMemo(() => {
    if (typeFilter === "all") {
      return Object.values(movementCategoriesByType).flat();
    }

    return movementCategoriesByType[typeFilter];
  }, [typeFilter]);

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((purchase) => {
        const movementType = purchase.movementType ?? (purchase.entryType === "investment" ? "inversion" : purchase.affectsInventory ? "compra" : "operativo");
        const category = purchase.category ?? (movementType === "compra" ? "materia_prima" : movementType);

        return (typeFilter === "all" || movementType === typeFilter) && (categoryFilter === "all" || category === categoryFilter);
      }),
    [categoryFilter, purchases, typeFilter],
  );

  const totalHistoryPages = Math.max(1, Math.ceil(filteredPurchases.length / HISTORY_PAGE_SIZE));
  const autocompleteOptions = useMemo(() => {
    const names = new Set<string>();

    for (const purchase of purchases) {
      if (purchase.detail.trim()) names.add(purchase.detail.trim());
    }

    for (const item of inventory) {
      if (item.name.trim()) names.add(item.name.trim());
    }

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [inventory, purchases]);

  const paginatedPurchases = useMemo(
    () => filteredPurchases.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE),
    [filteredPurchases, historyPage],
  );

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, totalHistoryPages));
  }, [totalHistoryPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [categoryFilter, typeFilter]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onImport(content);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const completeKnownProduct = (detail: string) => {
    const normalizedDetail = normalizeText(detail);

    if (!normalizedDetail) {
      onChange((current) => ({ ...current, detail }));
      return;
    }

    const matchingPurchase = purchases.find((purchase) => normalizeText(purchase.detail) === normalizedDetail);
    const matchingInventoryItem = inventory.find((item) => normalizeText(item.name) === normalizedDetail);

    onChange((current) => {
      if (matchingPurchase) {
        return {
          ...current,
          detail,
          quantity: String(matchingPurchase.quantity),
          unit: matchingPurchase.unit ?? current.unit,
          amount: String(matchingPurchase.amount ?? matchingPurchase.total),
          paymentMethod: matchingPurchase.paymentMethod ?? current.paymentMethod,
          type: matchingPurchase.movementType ?? current.type,
          category: matchingPurchase.category ?? current.category,
        };
      }

      if (matchingInventoryItem) {
        return {
          ...current,
          detail,
          quantity: current.quantity || String(matchingInventoryItem.quantity),
          amount: current.amount || String(matchingInventoryItem.total),
          type: "compra",
          category: movementCategoriesByType.compra.includes(current.category) ? current.category : "materia_prima",
        };
      }

      return { ...current, detail };
    });
  };

  return (
    <section id="movimientos" className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Exportar movimientos CSV
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          className="rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
        >
          Importar movimientos CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="min-h-0 flex-1 grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <article className={`${shellCardClass} space-y-4 overflow-hidden`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-rose-950">{isEditing ? "Editar movimiento" : "Nuevo movimiento"}</h3>
              <p className="text-sm text-rose-700/80">Primero elige el tipo y luego la categoria correspondiente.</p>
            </div>
            {isEditing ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-50"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Paso 1 - Tipo de movimiento</span>
                <select
                  value={form.type}
                  onChange={(event) =>
                    onChange((current) => {
                      const nextType = event.target.value as PurchaseFormState["type"];
                      const nextCategories = movementCategoriesByType[nextType];

                      return {
                        ...current,
                        type: nextType,
                        category: nextCategories.includes(current.category) ? current.category : nextCategories[0],
                      };
                    })
                  }
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                >
                  <option value="compra">Compra</option>
                  <option value="personal">Personal</option>
                  <option value="operativo">Operativo</option>
                  <option value="inversion">Inversion</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Paso 2 - Categoria</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      category: event.target.value as MovementCategory,
                    }))
                  }
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {movementCategoryLabels[category]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-rose-800">Detalle</span>
              <input
                list="purchase-detail-options"
                value={form.detail}
                onChange={(event) => completeKnownProduct(event.target.value.toUpperCase())}
                className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                placeholder="ENVASE PAPAS FRITAS BLANCO"
              />
              <datalist id="purchase-detail-options">
                {autocompleteOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Cantidad</span>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => onChange((current) => ({ ...current, quantity: event.target.value }))}
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                  placeholder="20"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Unidad</span>
                <input
                  value={form.unit}
                  onChange={(event) => onChange((current) => ({ ...current, unit: event.target.value.toLowerCase() }))}
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                  placeholder="unidad"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Monto</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={(event) => onChange((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                  placeholder="12000"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Medio de pago</span>
                <select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      paymentMethod: event.target.value as PurchaseFormState["paymentMethod"],
                    }))
                  }
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                >
                  {Object.entries(movementPaymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Fecha</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => onChange((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="rounded-[1.5rem] bg-gradient-to-r from-rose-50 to-fuchsia-50 px-4 py-4">
              <p className="text-sm font-medium text-rose-500">{movementTypeLabels[form.type]}</p>
              <p className="mt-1 text-xs text-rose-600/80">{movementCategoryLabels[form.category]}</p>
              <p className="mt-2 text-2xl font-bold text-rose-950">{formatCurrency(previewTotal)}</p>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-300/50 transition hover:bg-rose-600"
            >
              {isEditing ? "Actualizar movimiento" : "Guardar movimiento"}
            </button>
          </form>
        </article>

        <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-rose-950">Historial de movimientos</h3>
              <p className="text-sm text-rose-700/80">Todos los egresos quedan persistidos localmente e importan CSV con cantidad y valor unitario.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {formatNumber(filteredPurchases.length)} registros
            </span>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Tipo</span>
              <select
                value={typeFilter}
                onChange={(event) => {
                  const nextType = event.target.value as MovementType | "all";
                  setTypeFilter(nextType);
                  setCategoryFilter("all");
                }}
                className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-4 py-2.5 text-sm outline-none transition focus:border-fuchsia-400 focus:bg-white"
              >
                <option value="all">Todos los tipos</option>
                {Object.entries(movementTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Categoria</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as MovementCategory | "all")}
                className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-4 py-2.5 text-sm outline-none transition focus:border-fuchsia-400 focus:bg-white"
              >
                <option value="all">Todas las categorias</option>
                {[...new Set(filterCategoryOptions)].map((category) => (
                  <option key={category} value={category}>
                    {movementCategoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <TableEmpty message="Cargando movimientos..." />
          ) : purchases.length === 0 ? (
            <TableEmpty message="Todavia no hay movimientos registrados." />
          ) : filteredPurchases.length === 0 ? (
            <TableEmpty message="No hay movimientos con esos filtros." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-rose-500">
                  <tr>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Detalle</th>
                    <th className="pb-3 pr-4 font-semibold">Tipo</th>
                    <th className="pb-3 pr-4 font-semibold">Categoria</th>
                    <th className="pb-3 pr-4 font-semibold">Cantidad</th>
                    <th className="pb-3 pr-4 font-semibold">Unidad</th>
                    <th className="pb-3 pr-4 font-semibold">Medio pago</th>
                    <th className="pb-3 pr-4 font-semibold">Monto</th>
                    <th className="pb-3 font-semibold">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPurchases.map((purchase) => (
                    <tr key={purchase.id} className="border-t border-rose-100 align-top text-rose-900">
                      <td className="py-4 pr-4">{formatShortDate(purchase.date)}</td>
                      <td className="py-4 pr-4 font-semibold">{purchase.detail}</td>
                      <td className="py-4 pr-4">
                        {purchase.movementType ? movementTypeLabels[purchase.movementType] : purchaseItemTypeLabels[purchase.itemType ?? "operating_expense"]}
                      </td>
                      <td className="py-4 pr-4">{purchase.category ? movementCategoryLabels[purchase.category] : "Sin categoria"}</td>
                      <td className="py-4 pr-4">{formatNumber(purchase.quantity)}</td>
                      <td className="py-4 pr-4">{purchase.unit ?? "unidad"}</td>
                      <td className="py-4 pr-4">
                        {purchase.paymentMethod ? movementPaymentMethodLabels[purchase.paymentMethod] : purchase.supplier}
                      </td>
                      <td className="py-4 pr-4 font-bold text-rose-700">{formatCurrency(purchase.amount ?? purchase.total)}</td>
                      <td className="py-4">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActionsPurchaseId((current) => (current === purchase.id ? null : purchase.id))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 shadow-sm transition hover:border-fuchsia-700 hover:bg-fuchsia-700 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                            aria-label="Abrir opciones de movimiento"
                          >
                            <DotsIcon />
                          </button>

                          {actionsPurchaseId === purchase.id ? (
                            <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-[1rem] border border-rose-100 bg-white p-2 text-left shadow-[0_18px_45px_rgba(28,25,23,0.16)]">
                              <button
                                type="button"
                                onClick={() => {
                                  setActionsPurchaseId(null);
                                  onEdit(purchase);
                                }}
                                className="block w-full rounded-[0.8rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-700 transition hover:bg-fuchsia-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionsPurchaseId(null);
                                  if (window.confirm("Quieres eliminar este movimiento?")) {
                                    onDelete(purchase.id);
                                  }
                                }}
                                className="block w-full rounded-[0.8rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-rose-600 transition hover:bg-rose-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls
                page={historyPage}
                pageSize={HISTORY_PAGE_SIZE}
                totalItems={filteredPurchases.length}
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
