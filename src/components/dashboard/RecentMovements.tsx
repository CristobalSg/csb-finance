import { shellCardClass } from "../../constants/app";
import { formatDateTime } from "../../lib/date";
import { formatCurrency } from "../../lib/format";

export function RecentMovements({
  items,
}: {
  items: {
    id: string;
    title: string;
    subtitle: string;
    amount: number;
    kind: "Ingreso" | "Egreso";
    createdAt: string;
  }[];
}) {
  return (
    <article className={`${shellCardClass} flex min-h-[28rem] flex-col space-y-4 xl:min-h-0`}>
      <div>
        <p className="text-sm font-medium text-rose-500">Movimientos recientes</p>
        <p className="mt-1 text-sm text-rose-700/80">Compras y ventas mas nuevas guardadas en tu dispositivo.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {items.length === 0 ? (
          <p className="rounded-[1.5rem] bg-rose-50 px-4 py-6 text-sm text-rose-700">
            Aun no hay movimientos. Agrega una compra o una venta para empezar.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-[1.5rem] border border-rose-100 bg-rose-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-rose-950">{item.title}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-500">{item.kind}</span>
                </div>
                <p className="mt-1 text-sm text-rose-700">{item.subtitle}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className={`text-lg font-bold ${item.kind === "Ingreso" ? "text-fuchsia-700" : "text-rose-700"}`}>
                  {formatCurrency(item.amount)}
                </p>
                <p className="text-xs text-rose-500">{formatDateTime(item.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
