import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PaginationControls } from "../components/common/PaginationControls";
import { TableEmpty } from "../components/common/TableEmpty";
import {
  internalSupplyModeLabels,
  purchaseItemTypeLabels,
  shellCardClass,
  stockControlModeLabels,
  type PurchaseFormState,
} from "../constants/app";
import { getCurrentDate, formatShortDate } from "../lib/date";
import { formatCurrency, formatNumber } from "../lib/format";
import type { InventoryItem, Purchase, PurchaseEntryType } from "../types";

const HISTORY_PAGE_SIZE = 8;
const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const itemTypeExamples: Record<PurchaseFormState["itemType"], string> = {
  sale_inventory: "Ejemplos: pan, papitas, bebidas.",
  rotating_input: "Ejemplos: aceite, gas.",
  operating_expense: "Ejemplos: luz, agua, internet.",
  internal_supply: "Ejemplos: esponjas, bolsas, servilletas.",
};

export function PurchasesSection({
  loading,
  purchases,
  inventory,
  form,
  onChange,
  previewTotal,
  onSubmit,
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (csvContent: string, entryType: PurchaseEntryType) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTypeRef = useRef<PurchaseEntryType>("expense");
  const [historyPage, setHistoryPage] = useState(1);
  const affectsInventory =
    form.itemType === "sale_inventory" ||
    form.itemType === "rotating_input" ||
    (form.itemType === "internal_supply" && form.internalSupplyMode === "stock");

  const totalHistoryPages = Math.max(1, Math.ceil(purchases.length / HISTORY_PAGE_SIZE));
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
    () => purchases.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE),
    [historyPage, purchases],
  );

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, totalHistoryPages));
  }, [totalHistoryPages]);

  const handleImportClick = (entryType: PurchaseEntryType) => {
    importTypeRef.current = entryType;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onImport(content, importTypeRef.current);
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
          supplier: matchingPurchase.supplier,
          unitPrice: String(matchingPurchase.unitPrice),
          entryType: matchingPurchase.entryType ?? current.entryType,
          itemType: matchingPurchase.itemType ?? current.itemType,
          stockControl: matchingPurchase.stockControl ?? current.stockControl,
          internalSupplyMode: matchingPurchase.internalSupplyMode ?? current.internalSupplyMode,
        };
      }

      if (matchingInventoryItem) {
        return {
          ...current,
          detail,
          quantity: current.quantity || String(matchingInventoryItem.quantity),
          supplier: current.supplier || matchingInventoryItem.place,
          unitPrice: current.unitPrice || String(matchingInventoryItem.unitPrice),
          itemType: matchingInventoryItem.itemType ?? current.itemType,
          stockControl: matchingInventoryItem.stockControl ?? current.stockControl,
          internalSupplyMode: matchingInventoryItem.itemType === "internal_supply" ? "stock" : current.internalSupplyMode,
        };
      }

      return { ...current, detail };
    });
  };

  return (
    <section id="compras" className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Exportar compras CSV
        </button>
        <button
          type="button"
          onClick={() => handleImportClick("investment")}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Importar inversion inicial
        </button>
        <button
          type="button"
          onClick={() => handleImportClick("expense")}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Importar gastos
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
              <h3 className="text-xl font-bold text-rose-950">Nueva compra</h3>
              <p className="text-sm text-rose-700/80">La fecha se guarda automaticamente como hoy.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {formatShortDate(getCurrentDate())}
            </span>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
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

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-rose-800">Tipo de item</span>
              <select
                value={form.itemType}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    itemType: event.target.value as PurchaseFormState["itemType"],
                  }))
                }
                className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
              >
                <option value="sale_inventory">Inventario para venta</option>
                <option value="rotating_input">Insumo rotativo</option>
                <option value="operating_expense">Gasto operativo</option>
                <option value="internal_supply">Suministro interno</option>
              </select>
              <span className="block rounded-[1rem] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {itemTypeExamples[form.itemType]}
              </span>
            </label>

            {form.itemType === "rotating_input" ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Control del insumo</span>
                <select
                  value={form.stockControl}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      stockControl: event.target.value as PurchaseFormState["stockControl"],
                    }))
                  }
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                >
                  <option value="batch">Control por lote</option>
                  <option value="consumption">Control por consumo</option>
                  <option value="simple">Stock simple</option>
                </select>
              </label>
            ) : null}

            {form.itemType === "internal_supply" ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-rose-800">Tratamiento del suministro</span>
                <select
                  value={form.internalSupplyMode}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      internalSupplyMode: event.target.value as PurchaseFormState["internalSupplyMode"],
                    }))
                  }
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                >
                  <option value="expense">Registrar como gasto</option>
                  <option value="stock">Registrar como stock interno</option>
                </select>
              </label>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
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
                <span className="text-sm font-semibold text-rose-800">Precio unitario</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.unitPrice}
                  onChange={(event) => onChange((current) => ({ ...current, unitPrice: event.target.value }))}
                  className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                  placeholder="100"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-rose-800">Proveedor / lugar</span>
              <input
                value={form.supplier}
                onChange={(event) => onChange((current) => ({ ...current, supplier: event.target.value.toUpperCase() }))}
                className="w-full rounded-[1.2rem] border border-rose-200 bg-rose-50/60 px-4 py-3 outline-none transition focus:border-fuchsia-400 focus:bg-white"
                placeholder="ZURPLAST"
              />
            </label>

            <div className="rounded-[1.5rem] bg-gradient-to-r from-rose-50 to-fuchsia-50 px-4 py-4">
              <p className="text-sm font-medium text-rose-500">Total automatico</p>
              <p className="mt-1 text-xs text-rose-600/80">
                {affectsInventory
                  ? "Se calcula como cantidad x precio unitario y genera entrada de stock."
                  : "Se calcula como cantidad x precio unitario y queda solo como gasto."}
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-950">{formatCurrency(previewTotal)}</p>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-300/50 transition hover:bg-rose-600"
            >
              Guardar compra
            </button>
          </form>
        </article>

        <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-rose-950">Historial de compras</h3>
              <p className="text-sm text-rose-700/80">Todos los egresos quedan persistidos localmente e importan CSV con cantidad y valor unitario.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {formatNumber(purchases.length)} registros
            </span>
          </div>

          {loading ? (
            <TableEmpty message="Cargando compras..." />
          ) : purchases.length === 0 ? (
            <TableEmpty message="Todavia no hay compras registradas." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-rose-500">
                  <tr>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Detalle</th>
                    <th className="pb-3 pr-4 font-semibold">Tipo</th>
                    <th className="pb-3 pr-4 font-semibold">Impacto</th>
                    <th className="pb-3 pr-4 font-semibold">Cantidad</th>
                    <th className="pb-3 pr-4 font-semibold">Lugar</th>
                    <th className="pb-3 pr-4 font-semibold">Precio unitario</th>
                    <th className="pb-3 pr-4 font-semibold">Total</th>
                    <th className="pb-3 font-semibold">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPurchases.map((purchase) => (
                    <tr key={purchase.id} className="border-t border-rose-100 align-top text-rose-900">
                      <td className="py-4 pr-4">{formatShortDate(purchase.date)}</td>
                      <td className="py-4 pr-4 font-semibold">{purchase.detail}</td>
                      <td className="py-4 pr-4">{purchaseItemTypeLabels[purchase.itemType ?? "operating_expense"]}</td>
                      <td className="py-4 pr-4">
                        {purchase.affectsInventory ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Stock {stockControlModeLabels[purchase.stockControl ?? "simple"].toLowerCase()}
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                            {purchase.itemType === "internal_supply"
                              ? internalSupplyModeLabels[purchase.internalSupplyMode ?? "expense"]
                              : "Solo gasto"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-4">{formatNumber(purchase.quantity)}</td>
                      <td className="py-4 pr-4">{purchase.supplier}</td>
                      <td className="py-4 pr-4">{formatCurrency(purchase.unitPrice)}</td>
                      <td className="py-4 pr-4 font-bold text-rose-700">{formatCurrency(purchase.total)}</td>
                      <td className="py-4">
                        <button
                          type="button"
                          onClick={() => onDelete(purchase.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 transition hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls
                page={historyPage}
                pageSize={HISTORY_PAGE_SIZE}
                totalItems={purchases.length}
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
