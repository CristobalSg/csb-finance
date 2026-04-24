import { shellCardClass } from "../../constants/app";
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";

type ProductMetric = {
  name: string;
  unitsSold: number;
  cost: number;
  price: number;
  marginUnit: number;
  marginPercent: number;
  absoluteProfit: number;
};

export function ProductMetricsTable({
  items,
  topByMargin,
  topByProfit,
}: {
  items: ProductMetric[];
  topByMargin: ProductMetric[];
  topByProfit: ProductMetric[];
}) {
  return (
    <article data-print-panel className={`${shellCardClass} flex min-h-[28rem] flex-col space-y-4`}>
      <div>
        <p className="text-sm font-medium text-rose-500">Metricas por producto</p>
        <p className="mt-1 text-sm text-rose-700/80">
          Tabla dinamica basada en costos, precios y ventas detectadas automaticamente en el sistema.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/60 p-4">
          <p className="text-sm font-medium text-rose-500">Top margen %</p>
          <div className="mt-3 space-y-2 text-sm text-rose-800">
            {topByMargin.length === 0 ? (
              <p>Sin datos suficientes.</p>
            ) : (
              topByMargin.slice(0, 3).map((item, index) => (
                <p key={item.name}>
                  {index + 1}. {item.name} · {formatPercent(item.marginPercent)}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/60 p-4">
          <p className="text-sm font-medium text-rose-500">Top ganancia abs.</p>
          <div className="mt-3 space-y-2 text-sm text-rose-800">
            {topByProfit.length === 0 ? (
              <p>Sin datos suficientes.</p>
            ) : (
              topByProfit.slice(0, 3).map((item, index) => (
                <p key={item.name}>
                  {index + 1}. {item.name} · {formatCurrency(item.absoluteProfit)}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[1.5rem] bg-rose-50 px-4 py-6 text-sm text-rose-700">
          Aun no hay suficientes ventas con productos reconocibles para calcular margenes.
        </div>
      ) : (
        <div data-print-table-scroll className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-rose-500">
              <tr>
                <th className="pb-3 pr-4 font-semibold">Producto</th>
                <th className="pb-3 pr-4 font-semibold">Unidades</th>
                <th className="pb-3 pr-4 font-semibold">Costo</th>
                <th className="pb-3 pr-4 font-semibold">Precio</th>
                <th className="pb-3 pr-4 font-semibold">Margen unit.</th>
                <th className="pb-3 pr-4 font-semibold">Margen %</th>
                <th className="pb-3 font-semibold">Ganancia abs.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name} className="border-t border-rose-100 align-top text-rose-900">
                  <td className="py-4 pr-4 font-semibold">{item.name}</td>
                  <td className="py-4 pr-4">{formatNumber(item.unitsSold)}</td>
                  <td className="py-4 pr-4">{formatCurrency(item.cost)}</td>
                  <td className="py-4 pr-4">{formatCurrency(item.price)}</td>
                  <td className="py-4 pr-4">{formatCurrency(item.marginUnit)}</td>
                  <td className="py-4 pr-4">{formatPercent(item.marginPercent)}</td>
                  <td className="py-4 font-bold text-fuchsia-700">{formatCurrency(item.absoluteProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
