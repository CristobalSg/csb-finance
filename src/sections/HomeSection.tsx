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
  customizations: CartItemCustomization[];
  drinkOptions?: string[];
  sauceOptions?: string[];
  removableIngredients?: string[];
};

type CartItemCustomization = {
  id: string;
  drink?: string;
  sauce?: string;
  removedIngredients: string[];
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
    deliveryFee?: number;
    fulfillmentTime?: string;
    orderItems: SaleOrderItem[];
    quantity: number;
    productName?: string;
  }) => Promise<boolean>;
}) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSections, setPrintSections] = useState({
    kitchen: true,
    receipt: true,
    thanks: true,
  });
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("retiro");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [fulfillmentTime, setFulfillmentTime] = useState("");
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

  const deliveryFeeAmount = deliveryType === "delivery" ? Number.parseInt(deliveryFee, 10) || 0 : 0;
  const orderTotal = cartTotal + deliveryFeeAmount;

  const createCustomization = (item: OrderMenuItem | CartItem): CartItemCustomization => ({
    id: crypto.randomUUID(),
    drink: item.drinkOptions?.[0],
    sauce: item.sauceOptions?.[0],
    removedIngredients: [],
  });

  const addItem = (item: OrderMenuItem) => {
    setCartItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: item.name,
        price: item.price,
        quantity: 1,
        customizations: [createCustomization(item)],
        drinkOptions: item.drinkOptions,
        sauceOptions: item.sauceOptions,
        removableIngredients: item.removableIngredients,
      },
    ]);
  };

  const updateQuantity = (id: string, quantity: number) => {
    setCartItems((current) =>
      current
        .map((item) => {
          if (item.id !== id) {
            return item;
          }

          const customizations =
            quantity > item.customizations.length
              ? [
                  ...item.customizations,
                  ...Array.from({ length: quantity - item.customizations.length }, () => createCustomization(item)),
                ]
              : item.customizations.slice(0, quantity);

          return { ...item, quantity, customizations };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const updateCartItemCustomization = (itemId: string, customizationId: string, updates: Partial<CartItemCustomization>) => {
    setCartItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              customizations: item.customizations.map((customization) =>
                customization.id === customizationId ? { ...customization, ...updates } : customization,
              ),
            }
          : item,
      ),
    );
  };

  const toggleRemovedIngredient = (itemId: string, customizationId: string, ingredient: string) => {
    setCartItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          customizations: item.customizations.map((customization) => {
            if (customization.id !== customizationId) {
              return customization;
            }

            const shouldRemove = !customization.removedIngredients.includes(ingredient);

            return {
              ...customization,
              removedIngredients: shouldRemove
                ? [...customization.removedIngredients, ingredient]
                : customization.removedIngredients.filter((currentIngredient) => currentIngredient !== ingredient),
            };
          }),
        };
      }),
    );
  };

  const getCustomizationNotes = (customization: CartItemCustomization) => {
    const notes = [];

    if (customization.drink) {
      notes.push(`Bebida: ${customization.drink}`);
    }

    if (customization.sauce) {
      notes.push(`Salsa: ${customization.sauce}`);
    }

    if (customization.removedIngredients.length > 0) {
      notes.push(`Sin: ${customization.removedIngredients.join(", ")}`);
    }

    return notes;
  };

  const receiptItems = cartItems.flatMap((item) =>
    item.customizations.map((customization, index) => ({
      ...item,
      customization,
      unitLabel: item.quantity > 1 ? `${item.name} #${index + 1}` : item.name,
    })),
  );

  const kitchenGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        name: string;
        quantity: number;
        drinks: string[];
        sauces: string[];
        removedIngredients: string[];
      }
    >();

    for (const item of receiptItems) {
      const removedIngredients = [...item.customization.removedIngredients].sort((a, b) => a.localeCompare(b));
      const key = [
        item.name,
        item.customization.drink ?? "",
        item.customization.sauce ?? "",
        removedIngredients.join("|"),
      ].join("::");
      const existing = groups.get(key);

      if (existing) {
        existing.quantity += 1;
        continue;
      }

      groups.set(key, {
        name: item.name,
        quantity: 1,
        drinks: item.customization.drink ? [item.customization.drink] : [],
        sauces: item.customization.sauce ? [item.customization.sauce] : [],
        removedIngredients,
      });
    }

    return Array.from(groups.values());
  }, [receiptItems]);

  const kitchenSummary = useMemo(() => {
    const drinks = new Map<string, number>();
    const sauces = new Map<string, number>();

    for (const group of kitchenGroups) {
      for (const drink of group.drinks) {
        drinks.set(drink, (drinks.get(drink) ?? 0) + group.quantity);
      }

      for (const sauce of group.sauces) {
        sauces.set(sauce, (sauces.get(sauce) ?? 0) + group.quantity);
      }
    }

    const fries = receiptItems
      .filter((item) => item.name.toLowerCase().includes("papa") || item.name.toLowerCase().includes("papita"))
      .length;

    return {
      drinks: Array.from(drinks.entries()),
      sauces: Array.from(sauces.entries()),
      fries,
    };
  }, [kitchenGroups, receiptItems]);

  const buildOrderItems = (): SaleOrderItem[] =>
    receiptItems.map((item) => ({
      name: item.name,
      quantity: 1,
      unitPrice: item.price,
      total: item.price,
      drink: item.customization.drink,
      sauce: item.customization.sauce,
      removedIngredients: item.customization.removedIngredients,
    }));

  const handleConfirmPrint = async () => {
    if (isPrinting) {
      return;
    }

    if (!printSections.kitchen && !printSections.receipt && !printSections.thanks) {
      window.alert("Selecciona al menos una hoja para imprimir.");
      return;
    }

    if (deliveryType === "delivery" && !deliveryAddress.trim()) {
      window.alert("Ingresa la direccion para el delivery antes de confirmar.");
      return;
    }

    if (deliveryType === "delivery" && deliveryFeeAmount <= 0) {
      window.alert("Ingresa el valor del delivery antes de confirmar.");
      return;
    }

    setIsPrinting(true);
    const productName = cartItems.length === 1 ? cartItems[0].name : undefined;
    const saved = await onRegisterSale({
      client: orderName,
      detail: orderDetail,
      total: orderTotal,
      deliveryType,
      deliveryAddress,
      deliveryFee: deliveryFeeAmount,
      fulfillmentTime,
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
      setPrintSections({ kitchen: true, receipt: true, thanks: true });
      setDeliveryType("retiro");
      setDeliveryAddress("");
      setDeliveryFee("");
      setFulfillmentTime("");
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
              onClick={() => {
                setPrintSections({ kitchen: true, receipt: true, thanks: true });
                setIsReceiptOpen(true);
              }}
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
                        {item.customizations.map((customization, index) => (
                          <div
                            key={customization.id}
                            className={item.quantity > 1 ? "rounded-[1rem] border border-rose-100 bg-rose-50/40 p-3" : ""}
                          >
                            {item.quantity > 1 ? (
                              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-rose-500">
                                Unidad {index + 1}
                              </p>
                            ) : null}

                            <div className="space-y-3">
                              {item.drinkOptions ? (
                                <label className="block">
                                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Bebida</span>
                                  <select
                                    value={customization.drink}
                                    onChange={(event) =>
                                      updateCartItemCustomization(item.id, customization.id, { drink: event.target.value })
                                    }
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
                                    value={customization.sauce}
                                    onChange={(event) =>
                                      updateCartItemCustomization(item.id, customization.id, { sauce: event.target.value })
                                    }
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
                                      const isRemoved = customization.removedIngredients.includes(ingredient);

                                      return (
                                        <button
                                          key={ingredient}
                                          type="button"
                                          onClick={() => toggleRemovedIngredient(item.id, customization.id, ingredient)}
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
                          </div>
                        ))}
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
                onClick={() => {
                  setPrintSections({ kitchen: true, receipt: true, thanks: true });
                  setIsReceiptOpen(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar previsualizacion"
              >
                <XIcon />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[calc(80mm+2rem)_minmax(0,1fr)]">
              <div className="min-h-0 overflow-auto rounded-[1.5rem] bg-stone-100 p-4">
                <div data-receipt-print className="space-y-4">
                  {printSections.kitchen ? (
                  <div className="receipt-paper mx-auto lg:mx-0">
                    <div className="text-center">
                      <p className="text-xs font-black uppercase">Comanda</p>
                      <p className="mt-1 text-[11px] font-bold">{new Date().toLocaleString("es-CL")}</p>
                      <p className="mt-3 text-3xl font-black leading-none">{fulfillmentTime.trim() || "Ahora"}</p>
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />

                    <div className="receipt-cut space-y-1 text-xs font-semibold">
                      {orderName.trim() ? <p>Pedido: {orderName.trim()}</p> : null}
                      <p>Entrega: {deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
                      {deliveryType === "delivery" && deliveryAddress.trim() ? <p>Direccion: {deliveryAddress.trim()}</p> : null}
                      {orderDetail.trim() ? <p>Nota: {orderDetail.trim()}</p> : null}
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />

                    <div className="space-y-3">
                      {kitchenGroups.map((group, index) => (
                        <div key={`${group.name}-${index}`} className="receipt-cut">
                          <p className="text-sm font-black">
                            {group.quantity} x {group.name}
                          </p>
                          <div className="mt-1 space-y-0.5 text-xs font-semibold">
                            {group.removedIngredients.length > 0 ? <p>Sin: {group.removedIngredients.join(", ")}</p> : null}
                            {group.drinks.length > 0 ? <p>Bebida: {group.drinks.join(", ")}</p> : null}
                            {group.sauces.length > 0 ? <p>Salsa: {group.sauces.join(", ")}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(kitchenSummary.drinks.length > 0 || kitchenSummary.sauces.length > 0 || kitchenSummary.fries > 0) ? (
                      <>
                        <div className="my-3 border-t border-dashed border-black" />
                        <div className="receipt-cut space-y-2 text-xs font-bold">
                          {kitchenSummary.fries > 0 ? <p>Papas: {kitchenSummary.fries}</p> : null}
                          {kitchenSummary.drinks.length > 0 ? (
                            <div>
                              <p className="font-black uppercase">Bebidas</p>
                              {kitchenSummary.drinks.map(([drink, quantity]) => (
                                <p key={drink}>
                                  {quantity} x {drink}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          {kitchenSummary.sauces.length > 0 ? (
                            <div>
                              <p className="font-black uppercase">Salsas</p>
                              {kitchenSummary.sauces.map(([sauce, quantity]) => (
                                <p key={sauce}>
                                  {quantity} x {sauce}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                  ) : null}

                  {printSections.receipt ? (
                  <div className="receipt-paper mx-auto lg:mx-0">
                    <div className="text-center">
                      <img src="/receipt-logo.png" alt="Ceese Burger's" className="receipt-logo" />
                      <p className="mt-1 text-xs font-bold">{new Date().toLocaleString("es-CL")}</p>
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />

                    <div className="receipt-cut space-y-1 text-xs font-semibold">
                      {orderName.trim() ? <p>Nombre: {orderName.trim()}</p> : null}
                      {fulfillmentTime.trim() ? <p>Hora entrega: {fulfillmentTime.trim()}</p> : null}
                      <p>Pago: Pendiente</p>
                      <p>Entrega: {deliveryType === "delivery" ? "Delivery" : "Retiro"}</p>
                      {deliveryType === "delivery" && deliveryAddress.trim() ? <p>Direccion: {deliveryAddress.trim()}</p> : null}
                      {deliveryType === "delivery" ? <p>Valor delivery: {formatCurrency(deliveryFeeAmount)}</p> : null}
                      {orderDetail.trim() ? <p>Detalle: {orderDetail.trim()}</p> : null}
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />

                    <div className="space-y-3">
                      {receiptItems.map((item) => {
                        const notes = getCustomizationNotes(item.customization);

                        return (
                          <div key={`${item.id}-${item.customization.id}`} className="receipt-cut">
                            <div className="flex justify-between gap-2 text-xs font-bold">
                              <span className="min-w-0 break-words">1 x {item.unitLabel}</span>
                              <span className="shrink-0 whitespace-nowrap">{formatCurrency(item.price)}</span>
                            </div>
                            {notes.length > 0 ? (
                              <div className="mt-1 space-y-0.5 text-[11px] font-semibold leading-4">
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

                    {deliveryType === "delivery" ? (
                      <div className="space-y-1 text-xs font-bold">
                        <div className="flex justify-between gap-2">
                          <span>Subtotal</span>
                          <span className="shrink-0 whitespace-nowrap">{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span>Delivery</span>
                          <span className="shrink-0 whitespace-nowrap">{formatCurrency(deliveryFeeAmount)}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-2 flex justify-between text-sm font-black">
                      <span>Total</span>
                      <span className="shrink-0 whitespace-nowrap">{formatCurrency(orderTotal)}</span>
                    </div>
                  </div>
                  ) : null}

                  {printSections.thanks ? (
                  <div className="receipt-paper mx-auto lg:mx-0">
                    <div className="flex min-h-[48mm] flex-col items-center justify-center text-center">
                      <p className="text-xl font-black uppercase leading-tight">Muchas gracias</p>
                      <p className="mt-2 text-sm font-bold">Que las disfrute</p>
                      <p className="mt-3 text-base font-black uppercase">Ceese Burger's</p>
                    </div>
                  </div>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white p-4">
                <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
                  <div>
                    <p className="text-sm font-medium text-rose-500">Detalle del pedido</p>
                    <p className="mt-1 text-2xl font-black text-rose-950">{formatCurrency(orderTotal)}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_220px]">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Nombre pedido</span>
                      <input
                        value={orderName}
                        onChange={(event) => setOrderName(event.target.value)}
                        className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                        placeholder="Opcional"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Hora entrega</span>
                      <input
                        value={fulfillmentTime}
                        onChange={(event) => setFulfillmentTime(event.target.value)}
                        className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                        placeholder="20:00"
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
                  </div>

                  {deliveryType === "delivery" ? (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Direccion delivery</span>
                        <input
                          value={deliveryAddress}
                          onChange={(event) => setDeliveryAddress(event.target.value)}
                          className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                          placeholder="Calle, numero, referencia"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Valor delivery</span>
                        <input
                          value={deliveryFee}
                          onChange={(event) => setDeliveryFee(event.target.value.replace(/\D/g, ""))}
                          inputMode="numeric"
                          className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                          placeholder="0"
                        />
                      </label>
                    </div>
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
                      {receiptItems.map((item) => (
                        <div key={`${item.id}-${item.customization.id}`} className="flex justify-between gap-3">
                          <span>1 x {item.unitLabel}</span>
                          <span className="font-bold">{formatCurrency(item.price)}</span>
                        </div>
                      ))}
                      {deliveryType === "delivery" ? (
                        <div className="border-t border-rose-100 pt-2">
                          <div className="flex justify-between gap-3">
                            <span>Delivery</span>
                            <span className="font-bold">{formatCurrency(deliveryFeeAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-3 border-t border-rose-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintSections({ kitchen: true, receipt: true, thanks: true });
                      setIsReceiptOpen(false);
                    }}
                    className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Cancelar
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "kitchen", label: "Comanda" },
                      { key: "receipt", label: "Boleta" },
                      { key: "thanks", label: "Gracias" },
                    ].map((option) => (
                      <label
                        key={option.key}
                        className="flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-800"
                      >
                        <input
                          type="checkbox"
                          checked={printSections[option.key as keyof typeof printSections]}
                          onChange={(event) =>
                            setPrintSections((current) => ({
                              ...current,
                              [option.key]: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-fuchsia-600"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
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
