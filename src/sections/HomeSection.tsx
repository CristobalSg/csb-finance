import { useMemo, useState } from "react";

import { PrintIcon, XIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { orderMenuCategories, orderMenuItems, type OrderMenuItem } from "../data/order-menu";
import { formatCurrency } from "../lib/format";
import { setupReceiptPrintPage } from "../lib/receipt-print";
import type { DeliveryType, SaleOrderItem } from "../types";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  drink?: string;
  sauce?: string;
  removedIngredients: string[];
  drinkOptions?: string[];
  sauceOptions?: string[];
  removableIngredients?: string[];
};

export function HomeSection({
  onRegisterSale,
}: {
  onRegisterSale: (sale: {
    client?: string;
    detail: string;
    total: number;
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    orderItems: SaleOrderItem[];
    quantity: number;
    productName?: string;
  }) => Promise<boolean>;
}) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("retiro");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderName, setOrderName] = useState("");
  const [orderDetail, setOrderDetail] = useState("");

  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  const cartUnits = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const addItem = (item: OrderMenuItem) => {
    setCartItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: item.name,
        price: item.price,
        quantity: 1,
        drink: item.drinkOptions?.[0],
        sauce: item.sauceOptions?.[0],
        removedIngredients: [],
        drinkOptions: item.drinkOptions,
        sauceOptions: item.sauceOptions,
        removableIngredients: item.removableIngredients,
      },
    ]);
  };

  const updateQuantity = (id: string, quantity: number) => {
    setCartItems((current) =>
      current
        .map((item) => (item.id === id ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCartItems((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const toggleRemovedIngredient = (id: string, ingredient: string) => {
    setCartItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const shouldRemove = !item.removedIngredients.includes(ingredient);

        return {
          ...item,
          removedIngredients: shouldRemove
            ? [...item.removedIngredients, ingredient]
            : item.removedIngredients.filter((currentIngredient) => currentIngredient !== ingredient),
        };
      }),
    );
  };

  const getCartItemNotes = (item: CartItem) => {
    const notes = [];

    if (item.drink) {
      notes.push(`Bebida: ${item.drink}`);
    }

    if (item.sauce) {
      notes.push(`Salsa: ${item.sauce}`);
    }

    if (item.removedIngredients.length > 0) {
      notes.push(`Sin: ${item.removedIngredients.join(", ")}`);
    }

    return notes;
  };

  const buildOrderItems = (): SaleOrderItem[] =>
    cartItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
      drink: item.drink,
      sauce: item.sauce,
      removedIngredients: item.removedIngredients,
    }));

  const handleConfirmPrint = async () => {
    if (isPrinting) {
      return;
    }

    if (deliveryType === "delivery" && !deliveryAddress.trim()) {
      window.alert("Ingresa la direccion para el delivery antes de confirmar.");
      return;
    }

    setIsPrinting(true);
    const productName = cartItems.length === 1 ? cartItems[0].name : undefined;
    const saved = await onRegisterSale({
      client: orderName,
      detail: orderDetail,
      total: cartTotal,
      deliveryType,
      deliveryAddress,
      orderItems: buildOrderItems(),
      quantity: cartUnits,
      productName,
    });

    if (!saved) {
      setIsPrinting(false);
      return;
    }

    const removeReceiptPageStyle = setupReceiptPrintPage();
    document.body.classList.add("printing-receipt");
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("printing-receipt");
      removeReceiptPageStyle();
      setIsPrinting(false);
      setIsReceiptOpen(false);
      setCartItems([]);
      setDeliveryType("retiro");
      setDeliveryAddress("");
      setOrderName("");
      setOrderDetail("");
    }, 500);
  };

  return (
    <section className="flex h-full min-h-0 flex-col space-y-4 overflow-auto pr-1">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className={`${shellCardClass} flex min-h-[26rem] flex-col overflow-hidden`}>
          <div className="flex flex-col gap-2 border-b border-rose-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-rose-500">Menu</p>
              <h3 className="mt-1 text-xl font-bold text-rose-950">Productos disponibles</h3>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {orderMenuItems.length} opciones
            </span>
          </div>

          <div className="mt-5 space-y-6 overflow-auto pr-1">
            {orderMenuCategories.map((category) => (
              <div key={category.id}>
                <h4 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-rose-500">{category.label}</h4>
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {orderMenuItems
                    .filter((item) => item.category === category.id)
                    .map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => addItem(item)}
                        className="flex min-h-28 flex-col justify-between rounded-[1.35rem] border border-rose-100 bg-rose-50/60 p-4 text-left transition hover:border-fuchsia-200 hover:bg-white"
                      >
                        <span className="text-sm font-bold leading-5 text-rose-950">{item.name}</span>
                        <span className="mt-4 text-lg font-black text-fuchsia-700">{formatCurrency(item.price)}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className={`${shellCardClass} flex min-h-[26rem] flex-col overflow-hidden`}>
          <div className="border-b border-rose-100 pb-4">
            <p className="text-sm font-medium text-rose-500">Carrito</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <h3 className="text-xl font-bold text-rose-950">Pedido actual</h3>
              <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                {cartUnits} items
              </span>
            </div>
          </div>

          <div className="space-y-3 border-b border-rose-100 py-4">
            <div className="rounded-[1.35rem] bg-gradient-to-r from-rose-50 to-fuchsia-50 p-4">
              <p className="text-sm font-medium text-rose-500">Total pedido</p>
              <p className="mt-1 text-3xl font-black text-rose-950">{formatCurrency(cartTotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              disabled={cartItems.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PrintIcon />
              Imprimir boleta
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto py-4">
            {cartItems.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center rounded-[1.5rem] border border-dashed border-rose-200 bg-rose-50/60 px-5 text-center text-sm leading-6 text-rose-700">
                Selecciona productos del menu para comenzar a armar el pedido.
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <article key={item.id} className="rounded-[1.25rem] border border-rose-100 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold leading-5 text-rose-950">{item.name}</p>
                        <p className="mt-1 text-sm text-rose-500">{formatCurrency(item.price)} c/u</p>
                      </div>
                      <p className="shrink-0 font-black text-fuchsia-700">{formatCurrency(item.price * item.quantity)}</p>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-lg font-bold text-rose-700"
                        aria-label={`Restar ${item.name}`}
                      >
                        -
                      </button>
                      <span className="flex h-9 min-w-10 items-center justify-center rounded-full bg-rose-50 px-3 text-sm font-bold text-rose-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-lg font-bold text-rose-700"
                        aria-label={`Sumar ${item.name}`}
                      >
                        +
                      </button>
                    </div>

                    {item.drinkOptions || item.sauceOptions || item.removableIngredients ? (
                      <div className="mt-4 space-y-3 border-t border-rose-100 pt-4">
                        {item.drinkOptions ? (
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Bebida</span>
                            <select
                              value={item.drink}
                              onChange={(event) => updateCartItem(item.id, { drink: event.target.value })}
                              className="mt-2 w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                            >
                              {item.drinkOptions.map((drink) => (
                                <option key={drink} value={drink}>
                                  {drink}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {item.sauceOptions ? (
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Salsa</span>
                            <select
                              value={item.sauce}
                              onChange={(event) => updateCartItem(item.id, { sauce: event.target.value })}
                              className="mt-2 w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                            >
                              {item.sauceOptions.map((sauce) => (
                                <option key={sauce} value={sauce}>
                                  {sauce}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {item.removableIngredients ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Sin ingredientes</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.removableIngredients.map((ingredient) => {
                                const isRemoved = item.removedIngredients.includes(ingredient);

                                return (
                                  <button
                                    key={ingredient}
                                    type="button"
                                    onClick={() => toggleRemovedIngredient(item.id, ingredient)}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                      isRemoved
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : "border-rose-200 bg-white text-rose-600"
                                    }`}
                                  >
                                    {ingredient}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {isReceiptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Previsualizacion</p>
                <h3 className="text-xl font-bold text-rose-950">Boleta 80mm</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar previsualizacion"
              >
                <XIcon />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[calc(80mm+2rem)_minmax(0,1fr)]">
              <div className="min-h-0 overflow-auto rounded-[1.5rem] bg-stone-100 p-4">
                <div data-receipt-print className="receipt-paper mx-auto lg:mx-0">
                  <div className="text-center">
                    <p className="text-base font-black uppercase">Ceeseburgers</p>
                    <p className="mt-1 text-[11px]">{new Date().toLocaleString("es-CL")}</p>
                  </div>

                  <div className="my-3 border-t border-dashed border-black" />

                  <div className="receipt-cut space-y-1 text-[11px]">
                    {orderName.trim() ? <p>Nombre: {orderName.trim()}</p> : null}
                    <p>Pago: Pendiente</p>
                    <p>Entrega: {deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
                    {deliveryType === "delivery" && deliveryAddress.trim() ? <p>Direccion: {deliveryAddress.trim()}</p> : null}
                    {orderDetail.trim() ? <p>Detalle: {orderDetail.trim()}</p> : null}
                  </div>

                  <div className="my-3 border-t border-dashed border-black" />

                  <div className="space-y-3">
                    {cartItems.map((item) => {
                      const notes = getCartItemNotes(item);

                      return (
                        <div key={item.id} className="receipt-cut">
                          <div className="flex justify-between gap-2 text-xs font-bold">
                            <span className="min-w-0 break-words">
                              {item.quantity} x {item.name}
                            </span>
                            <span className="shrink-0 whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                          {notes.length > 0 ? (
                            <div className="mt-1 space-y-0.5 text-[10px] leading-4">
                              {notes.map((note) => (
                                <p key={note}>{note}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="my-3 border-t border-dashed border-black" />

                  <div className="flex justify-between text-sm font-black">
                    <span>Total</span>
                    <span className="shrink-0 whitespace-nowrap">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white p-4">
                <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
                  <div>
                    <p className="text-sm font-medium text-rose-500">Detalle del pedido</p>
                    <p className="mt-1 text-2xl font-black text-rose-950">{formatCurrency(cartTotal)}</p>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Nombre pedido</span>
                    <input
                      value={orderName}
                      onChange={(event) => setOrderName(event.target.value)}
                      className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                      placeholder="Opcional"
                    />
                  </label>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Entrega</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                      {[
                        { value: "retiro", label: "Retiro" },
                        { value: "delivery", label: "Delivery" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDeliveryType(option.value as DeliveryType)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                            deliveryType === option.value ? "bg-fuchsia-600 text-white" : "text-rose-700"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {deliveryType === "delivery" ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Direccion delivery</span>
                      <input
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                        placeholder="Calle, numero, referencia"
                      />
                    </label>
                  ) : null}

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Detalle / nota</span>
                    <textarea
                      rows={4}
                      value={orderDetail}
                      onChange={(event) => setOrderDetail(event.target.value)}
                      className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                      placeholder="Descuento, regalo, canje, consumo trabajador..."
                    />
                  </label>

                  <div className="rounded-[1.25rem] bg-rose-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Resumen</p>
                    <div className="mt-3 space-y-2 text-sm text-rose-800">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <span>{item.quantity} x {item.name}</span>
                          <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-3 border-t border-rose-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsReceiptOpen(false)}
                    className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPrint}
                    disabled={isPrinting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PrintIcon />
                    {isPrinting ? "Guardando venta..." : "Confirmar impresion"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
