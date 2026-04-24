import type { NavItem } from "../../constants/app";

export function MobileNav({
  items,
  activeItem,
  onSelect,
}: {
  items: NavItem[];
  activeItem: NavItem["id"];
  onSelect: (id: NavItem["id"]) => void;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
      {items.map((link) => (
        <button
          key={link.id}
          type="button"
          onClick={() => onSelect(link.id)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm transition ${
            activeItem === link.id ? "bg-fuchsia-600 text-white" : "bg-white text-rose-600"
          }`}
        >
          {link.icon}
          {link.label}
        </button>
      ))}
    </div>
  );
}
