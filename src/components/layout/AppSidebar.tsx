import { useEffect, useState } from "react";

import type { NavItem } from "../../constants/app";
import { shellCardClass } from "../../constants/app";
import { orderMenuCategories, type OrderMenuCategoryId } from "../../data/order-menu";
import { ArrowUpIcon } from "../icons";

export function AppSidebar({
  items,
  activeItem,
  activeMenuCategory,
  onSelect,
  onSelectMenuCategory,
}: {
  items: NavItem[];
  activeItem: NavItem["id"];
  activeMenuCategory: OrderMenuCategoryId;
  onSelect: (id: NavItem["id"]) => void;
  onSelectMenuCategory: (id: OrderMenuCategoryId) => void;
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    setIsPanelOpen(activeItem !== "home");
  }, [activeItem]);

  const openMenuCategory = (categoryId: OrderMenuCategoryId) => {
    onSelectMenuCategory(categoryId);
    onSelect("home");
  };

  return (
    <aside className="h-full min-h-0">
      <div className={`${shellCardClass} relative flex h-full flex-col overflow-hidden border-rose-100/80 bg-white/80 pb-20`}>
        <button
          type="button"
          onClick={() => onSelect("home")}
          className="mb-6 rounded-2xl border border-rose-100 bg-white/70 p-3 transition hover:border-fuchsia-200 hover:bg-white"
          aria-label="Ir al home"
        >
          <img
            src="/Logo_ceese_horizontal_png.png"
            alt="Ceese Burger's"
            className="h-auto w-full object-contain"
          />
        </button>

        {activeItem === "home" ? (
          <nav className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {orderMenuCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => openMenuCategory(category.id)}
                className={`flex w-full items-center rounded-[1.35rem] border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] transition ${
                  activeMenuCategory === category.id
                    ? "border-fuchsia-200 bg-white text-fuchsia-700 shadow-sm"
                    : "border-transparent bg-rose-50/80 text-rose-700 hover:border-rose-200 hover:bg-white hover:text-fuchsia-700"
                }`}
              >
                {category.label}
              </button>
            ))}
          </nav>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <div
          className={`absolute inset-x-0 bottom-0 z-20 rounded-t-[1.5rem] border-t border-rose-100 bg-white p-4 shadow-[0_-18px_55px_rgba(28,25,23,0.14)] transition-transform duration-300 ${
            isPanelOpen ? "translate-y-0" : "translate-y-[calc(100%-4.75rem)]"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsPanelOpen((current) => !current)}
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
            aria-label={isPanelOpen ? "Cerrar panel de navegacion" : "Abrir panel de navegacion"}
          >
            <span className={`transition-transform duration-300 ${isPanelOpen ? "rotate-180" : ""}`}>
              <ArrowUpIcon />
            </span>
          </button>

          <div className="mt-4 max-h-[calc(100vh-12rem)] space-y-3 overflow-auto pr-1">
            {items.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  onSelect(link.id);
                  setIsPanelOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-left text-sm font-semibold transition ${
                  activeItem === link.id
                    ? "border-fuchsia-200 bg-white text-fuchsia-700 shadow-sm"
                    : "border-transparent bg-rose-50/80 text-rose-700 hover:border-rose-200 hover:bg-white hover:text-fuchsia-700"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                    activeItem === link.id ? "bg-fuchsia-50 text-fuchsia-700" : "bg-white text-fuchsia-600"
                  }`}
                >
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
