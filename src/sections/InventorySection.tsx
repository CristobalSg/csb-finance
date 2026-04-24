import { TableEmpty } from "../components/common/TableEmpty";
import { purchaseItemTypeLabels, shellCardClass, stockControlModeLabels } from "../constants/app";
import { formatShortDate } from "../lib/date";
import { formatCurrency, formatNumber } from "../lib/format";
import type { InventoryItem } from "../types";

export function InventorySection({
  loading,
  inventory,
  onDelete,
  onExport,
}: {
  loading: boolean;
  inventory: InventoryItem[];
  onDelete: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <section id="inventario" className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onExport}
          className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Exportar inventario CSV
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <article className={`${shellCardClass} flex min-h-0 flex-col overflow-hidden`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-rose-950">Inventario actual</h3>
              <p className="text-sm text-rose-700/80">Las existencias se alimentan desde compras con impacto en stock.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {formatNumber(inventory.length)} productos
            </span>
          </div>

          {loading ? (
            <TableEmpty message="Cargando inventario..." />
          ) : inventory.length === 0 ? (
            <TableEmpty message="Todavia no hay productos en inventario." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-rose-500">
                  <tr>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Nombre</th>
                    <th className="pb-3 pr-4 font-semibold">Tipo</th>
                    <th className="pb-3 pr-4 font-semibold">Cantidad</th>
                    <th className="pb-3 pr-4 font-semibold">Lugar</th>
                    <th className="pb-3 pr-4 font-semibold">Precio unitario</th>
                    <th className="pb-3 pr-4 font-semibold">Total</th>
                    <th className="pb-3 font-semibold">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className="border-t border-rose-100 align-top text-rose-900">
                      <td className="py-4 pr-4">{formatShortDate(item.date)}</td>
                      <td className="py-4 pr-4 font-semibold">{item.name}</td>
                      <td className="py-4 pr-4">
                        {item.itemType ? purchaseItemTypeLabels[item.itemType] : "Stock manual"}
                        {item.stockControl && item.stockControl !== "simple" ? (
                          <span className="mt-1 block text-xs text-rose-500">{stockControlModeLabels[item.stockControl]}</span>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4">{formatNumber(item.quantity)}</td>
                      <td className="py-4 pr-4">{item.place || "Sin referencia"}</td>
                      <td className="py-4 pr-4">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 pr-4 font-bold text-rose-700">{formatCurrency(item.total)}</td>
                      <td className="py-4">
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 transition hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
