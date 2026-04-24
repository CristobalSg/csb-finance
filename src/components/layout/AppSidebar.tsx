import type { NavItem } from "../../constants/app";
import { shellCardClass } from "../../constants/app";

export function AppSidebar({
  items,
  activeItem,
  onSelect,
}: {
  items: NavItem[];
  activeItem: NavItem["id"];
  onSelect: (id: NavItem["id"]) => void;
}) {
  return (
    <aside className="h-full min-h-0">
      <div className={`${shellCardClass} flex h-full flex-col space-y-6 overflow-hidden border-rose-100/80 bg-white/80`}>
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">
            Navegacion
          </span>
        </div>

        <nav className="space-y-3">
          {items.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onSelect(link.id)}
              className={`flex w-full items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-left text-sm font-semibold transition ${
                activeItem === link.id
                  ? "border-fuchsia-200 bg-white text-fuchsia-700 shadow-sm"
                  : "border-transparent bg-rose-50/80 text-rose-700 hover:border-rose-200 hover:bg-white hover:text-fuchsia-700"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm ${
                  activeItem === link.id ? "bg-fuchsia-50 text-fuchsia-700" : "bg-white text-fuchsia-600"
                }`}
              >
                {link.icon}
              </span>
              <span>{link.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
