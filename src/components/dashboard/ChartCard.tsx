import { shellCardClass } from "../../constants/app";
import { formatCurrency } from "../../lib/format";
import { formatShortDate } from "../../lib/date";

export function ChartCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: { date: string; income: number; expense: number }[];
}) {
  const highestValue = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));

  return (
    <article data-print-panel className={`${shellCardClass} flex min-h-[28rem] flex-col space-y-4 xl:min-h-0`}>
      <div>
        <p className="text-sm font-medium text-rose-500">{title}</p>
        <p className="mt-1 text-sm text-rose-700/80">{subtitle}</p>
      </div>

      <div data-print-chart-scroll className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-1">
        <div data-print-chart-grid className="grid min-w-[34rem] h-full grid-cols-7 items-end gap-2">
          {data.map((item) => (
            <div key={item.date} className="flex flex-col items-center gap-3">
              <div className="flex h-44 w-full items-end justify-center gap-1 rounded-[1.5rem] bg-gradient-to-b from-rose-50 to-white p-3 xl:h-48">
                <div
                  className="w-3 rounded-full bg-rose-300"
                  style={{ height: `${Math.max(10, (item.expense / highestValue) * 100)}%` }}
                  title={`Egresos ${formatCurrency(item.expense)}`}
                />
                <div
                  className="w-3 rounded-full bg-fuchsia-600"
                  style={{ height: `${Math.max(10, (item.income / highestValue) * 100)}%` }}
                  title={`Ingresos ${formatCurrency(item.income)}`}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-rose-800">{formatShortDate(item.date)}</p>
                <p className="mt-1 text-[11px] text-fuchsia-600">{formatCurrency(item.income)}</p>
                <p className="text-[11px] text-rose-500">{formatCurrency(item.expense)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-rose-700">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-fuchsia-600" />
          Ingresos
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-300" />
          Gasto operativo
        </span>
      </div>
    </article>
  );
}
