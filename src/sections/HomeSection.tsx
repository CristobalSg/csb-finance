import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";

import { ImageOffIcon, PrintIcon, XIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import {
  familyComboBurgers,
  familyComboDescriptions,
  orderMenuCategories,
  orderMenuItems,
  type OrderMenuCategoryId,
  type OrderMenuItem,
} from "../data/order-menu";
import { formatCurrency } from "../lib/format";
import { printTicket } from "../lib/thermal-printer";
import { buildTicketData, type ReceiptPaperSize } from "../lib/thermal-ticket";
import type { DeliveryType, Sale, SaleFromOrderInput, SaleOrderItem } from "../types";

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
  familyBurgers?: CartItemFamilyBurger[];
};

type CartItemFamilyBurger = {
  id: string;
  label: string;
  name: string;
  removableIngredients: string[];
  removedIngredients: string[];
};

const defaultPrintSections = {
  kitchen: true,
  receipt: false,
  thanks: false,
};

const findMenuItem = (name: string) => orderMenuItems.find((item) => item.name.toLowerCase() === name.toLowerCase());

const createFamilyBurgerCustomization = (itemName: string) =>
  familyComboBurgers[itemName]?.map((burger) => ({
    id: crypto.randomUUID(),
    label: burger.label,
    name: burger.name,
    removableIngredients: burger.removableIngredients,
    removedIngredients: [],
  }));

export function HomeSection({
  activeMenuCategory,
  receiptLogoPath,
  saleCartDraft,
  onSaleCartDraftLoaded,
  onRegisterSale,
}: {
  activeMenuCategory: OrderMenuCategoryId;
  receiptLogoPath: string;
  saleCartDraft: Sale | null;
  onSaleCartDraftLoaded: () => void;
  onRegisterSale: (sale: SaleFromOrderInput) => Promise<boolean>;
}) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [editingCartSale, setEditingCartSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSections, setPrintSections] = useState(defaultPrintSections);
  const [receiptPaperSize, setReceiptPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("retiro");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [fulfillmentTime, setFulfillmentTime] = useState("");
  const [orderName, setOrderName] = useState("");
  const [orderDetail, setOrderDetail] = useState("");
  const [productModalItem, setProductModalItem] = useState<OrderMenuItem | null>(null);
  const [productModalQuantity, setProductModalQuantity] = useState(1);
  const [productModalCustomizations, setProductModalCustomizations] = useState<CartItemCustomization[]>([]);
  const [productModalStep, setProductModalStep] = useState(0);

  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  const cartUnits = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const deliveryFeeAmount = deliveryType === "delivery" ? Number.parseInt(deliveryFee, 10) || 0 : 0;
  const discountValue = Math.min(Number.parseInt(discountAmount, 10) || 0, cartTotal);
  const extraValue = Number.parseInt(extraAmount, 10) || 0;
  const discountedCartTotal = Math.max(0, cartTotal - discountValue);
  const orderTotal = discountedCartTotal + extraValue + deliveryFeeAmount;
  const receiptPreviewStyle = { "--receipt-width": receiptPaperSize } as CSSProperties;
  const activeCategory = orderMenuCategories.find((category) => category.id === activeMenuCategory) ?? orderMenuCategories[0];
  const activeCategoryItems = orderMenuItems.filter((item) => item.category === activeCategory.id);
  const productModalHasOptions = Boolean(productModalItem?.drinkOptions || productModalItem?.sauceOptions);

  const handleDeliveryTypeChange = (nextDeliveryType: DeliveryType) => {
    setDeliveryType(nextDeliveryType);

    if (nextDeliveryType === "delivery") {
      setDeliveryFee((current) => current || "2500");
    }
  };

  const createCustomization = (item: OrderMenuItem | CartItem): CartItemCustomization => {
    const familyBurgersForItem = createFamilyBurgerCustomization(item.name);

    return {
      id: crypto.randomUUID(),
      drink: item.drinkOptions?.[0],
      sauce: item.sauceOptions?.[0],
      removedIngredients: [],
      familyBurgers: familyBurgersForItem,
    };
  };

  const createDirectCustomization = (): CartItemCustomization => ({
    id: crypto.randomUUID(),
    removedIngredients: [],
  });

  const cloneCustomization = (customization: CartItemCustomization): CartItemCustomization => ({
    ...customization,
    id: crypto.randomUUID(),
    removedIngredients: [...customization.removedIngredients],
    familyBurgers: customization.familyBurgers?.map((burger) => ({
      ...burger,
      id: crypto.randomUUID(),
      removedIngredients: [...burger.removedIngredients],
    })),
  });

  const buildCartItemFromSaleItem = useCallback((saleItem: SaleOrderItem): CartItem => {
    const menuItem = findMenuItem(saleItem.name);
    const quantity = Math.max(1, Number(saleItem.quantity) || 1);
    const unitPrice = Number(saleItem.unitPrice) || Math.round((Number(saleItem.total) || 0) / quantity);
    const fallbackFamilyBurgers = createFamilyBurgerCustomization(saleItem.name);
    const familyBurgers = saleItem.familyBurgers?.length
      ? saleItem.familyBurgers.map((burger) => ({
          id: crypto.randomUUID(),
          label: burger.label,
          name: burger.name,
          removableIngredients:
            fallbackFamilyBurgers?.find((familyBurger) => familyBurger.label === burger.label || familyBurger.name === burger.name)
              ?.removableIngredients ?? [],
          removedIngredients: [...(burger.removedIngredients ?? [])],
        }))
      : fallbackFamilyBurgers;

    return {
      id: crypto.randomUUID(),
      name: saleItem.name,
      price: unitPrice,
      quantity,
      drinkOptions: menuItem?.drinkOptions,
      sauceOptions: menuItem?.sauceOptions,
      removableIngredients: menuItem?.removableIngredients,
      customizations: Array.from({ length: quantity }, () => ({
        id: crypto.randomUUID(),
        drink: saleItem.drink,
        sauce: saleItem.sauce,
        removedIngredients: [...(saleItem.removedIngredients ?? [])],
        familyBurgers: familyBurgers?.map((burger) => ({
          ...burger,
          id: crypto.randomUUID(),
          removedIngredients: [...burger.removedIngredients],
        })),
      })),
    };
  }, []);

  useEffect(() => {
    if (!saleCartDraft) {
      return;
    }

    const nextCartItems =
      saleCartDraft.orderItems?.length
        ? saleCartDraft.orderItems.map(buildCartItemFromSaleItem)
        : [
            buildCartItemFromSaleItem({
              name: saleCartDraft.productName || saleCartDraft.detail || "Pedido",
              quantity: saleCartDraft.quantity || 1,
              unitPrice: Math.round(saleCartDraft.total / Math.max(1, saleCartDraft.quantity || 1)),
              total: saleCartDraft.total,
            }),
          ];

    setCartItems(nextCartItems);
    setEditingCartSale(saleCartDraft);
    setIsReceiptOpen(false);
    setPrintSections(defaultPrintSections);
    setReceiptPaperSize("80mm");
    setIsAdvancedOpen(true);
    setDiscountAmount(saleCartDraft.discountAmount ? String(saleCartDraft.discountAmount) : "");
    setExtraAmount(saleCartDraft.extraAmount ? String(saleCartDraft.extraAmount) : "");
    setDeliveryType(saleCartDraft.deliveryType ?? "retiro");
    setDeliveryAddress(saleCartDraft.deliveryAddress ?? "");
    setDeliveryFee(saleCartDraft.deliveryType === "delivery" ? String(saleCartDraft.deliveryFee ?? 2500) : "");
    setFulfillmentTime(saleCartDraft.fulfillmentTime ?? "");
    setOrderName(saleCartDraft.client ?? "");
    setOrderDetail(saleCartDraft.detail ?? "");
    closeProductModal();
    onSaleCartDraftLoaded();
  }, [buildCartItemFromSaleItem, saleCartDraft, onSaleCartDraftLoaded]);

  const openProductModal = (item: OrderMenuItem) => {
    setProductModalItem(item);
    setProductModalQuantity(1);
    setProductModalCustomizations([createCustomization(item)]);
    setProductModalStep(0);
  };

  const shouldAddDirectly = (item: OrderMenuItem) => item.category === "sides" || item.category === "sauces";

  const handleProductClick = (item: OrderMenuItem) => {
    if (shouldAddDirectly(item)) {
      addItem(item, [createDirectCustomization()]);
      return;
    }

    openProductModal(item);
  };

  const closeProductModal = () => {
    setProductModalItem(null);
    setProductModalQuantity(1);
    setProductModalCustomizations([]);
    setProductModalStep(0);
  };

  const addItem = (item: OrderMenuItem, customizations = [createCustomization(item)]) => {
    setCartItems((current) => [
      {
        id: crypto.randomUUID(),
        name: item.name,
        price: item.price,
        quantity: customizations.length,
        customizations: customizations.map(cloneCustomization),
        drinkOptions: item.drinkOptions,
        sauceOptions: item.sauceOptions,
        removableIngredients: item.removableIngredients,
      },
      ...current,
    ]);
  };

  const confirmProductModal = () => {
    if (!productModalItem || productModalCustomizations.length === 0) {
      return;
    }

    addItem(productModalItem, productModalCustomizations);
    closeProductModal();
  };

  const goToNextProductModalStep = () => {
    if (productModalStep === 0) {
      setProductModalStep(productModalHasOptions ? 1 : 2);
      return;
    }

    if (productModalStep === 1) {
      setProductModalStep(2);
    }
  };

  const goToPreviousProductModalStep = () => {
    if (productModalStep === 2) {
      setProductModalStep(productModalHasOptions ? 1 : 0);
      return;
    }

    if (productModalStep === 1) {
      setProductModalStep(0);
    }
  };

  const updateProductModalQuantity = (nextQuantity: number) => {
    if (!productModalItem) {
      return;
    }

    const quantity = Math.max(1, nextQuantity);
    setProductModalQuantity(quantity);
    setProductModalCustomizations((current) =>
      quantity > current.length
        ? [...current, ...Array.from({ length: quantity - current.length }, () => createCustomization(productModalItem))]
        : current.slice(0, quantity),
    );
  };

  const updateProductModalCustomization = (customizationId: string, updates: Partial<CartItemCustomization>) => {
    setProductModalCustomizations((current) =>
      current.map((customization) => (customization.id === customizationId ? { ...customization, ...updates } : customization)),
    );
  };

  const toggleProductModalRemovedIngredient = (customizationId: string, ingredient: string) => {
    setProductModalCustomizations((current) =>
      current.map((customization) => {
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
    );
  };

  const toggleProductModalFamilyBurgerRemovedIngredient = (customizationId: string, burgerId: string, ingredient: string) => {
    setProductModalCustomizations((current) =>
      current.map((customization) => {
        if (customization.id !== customizationId) {
          return customization;
        }

        return {
          ...customization,
          familyBurgers: customization.familyBurgers?.map((burger) => {
            if (burger.id !== burgerId) {
              return burger;
            }

            const shouldRemove = !burger.removedIngredients.includes(ingredient);

            return {
              ...burger,
              removedIngredients: shouldRemove
                ? [...burger.removedIngredients, ingredient]
                : burger.removedIngredients.filter((currentIngredient) => currentIngredient !== ingredient),
            };
          }),
        };
      }),
    );
  };

  const removeCartItem = (id: string) => {
    setCartItems((current) => current.filter((item) => item.id !== id));
  };

  const getFamilyBurgerNotes = (customization: Pick<CartItemCustomization, "familyBurgers">) =>
    customization.familyBurgers
      ?.filter((burger) => burger.removedIngredients.length > 0)
      .map((burger) => `${burger.label}: sin ${burger.removedIngredients.join(", ")}`) ?? [];

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

    notes.push(...getFamilyBurgerNotes(customization));

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
        familyBurgerNotes: string[];
      }
    >();

    for (const item of receiptItems) {
      const removedIngredients = [...item.customization.removedIngredients].sort((a, b) => a.localeCompare(b));
      const familyBurgerNotes = getFamilyBurgerNotes(item.customization);
      const key = [
        item.name,
        item.customization.drink ?? "",
        item.customization.sauce ?? "",
        removedIngredients.join("|"),
        familyBurgerNotes.join("|"),
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
        familyBurgerNotes,
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
      familyBurgers: item.customization.familyBurgers?.map((burger) => ({
        label: burger.label,
        name: burger.name,
        removedIngredients: burger.removedIngredients,
      })),
    }));

  const renderReceiptPapers = (preview = false) => (
    <>
      {printSections.kitchen ? (
        <div className={`receipt-paper ${preview ? "mx-auto lg:mx-0" : ""}`}>
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
                  {familyComboDescriptions[group.name] ? <p>Incluye: {familyComboDescriptions[group.name]}</p> : null}
                  {group.removedIngredients.length > 0 ? <p>Sin: {group.removedIngredients.join(", ")}</p> : null}
                  {group.familyBurgerNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  {group.drinks.length > 0 ? <p>Bebida: {group.drinks.join(", ")}</p> : null}
                  {group.sauces.length > 0 ? <p>Salsa: {group.sauces.join(", ")}</p> : null}
                </div>
              </div>
            ))}
          </div>

          {kitchenSummary.drinks.length > 0 || kitchenSummary.sauces.length > 0 || kitchenSummary.fries > 0 ? (
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
        <div className={`receipt-paper ${preview ? "mx-auto lg:mx-0" : ""}`}>
          <div className="text-center">
            <img src={`/${receiptLogoPath}`} alt="Ceese Burger's" className="receipt-logo" />
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
            {discountValue > 0 ? <p>Descuento: -{formatCurrency(discountValue)}</p> : null}
            {extraValue > 0 ? <p>Agregado: {formatCurrency(extraValue)}</p> : null}
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
              {discountValue > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Descuento</span>
                  <span className="shrink-0 whitespace-nowrap">-{formatCurrency(discountValue)}</span>
                </div>
              ) : null}
              {extraValue > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Agregado</span>
                  <span className="shrink-0 whitespace-nowrap">{formatCurrency(extraValue)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <span>Delivery</span>
                <span className="shrink-0 whitespace-nowrap">{formatCurrency(deliveryFeeAmount)}</span>
              </div>
            </div>
          ) : discountValue > 0 || extraValue > 0 ? (
            <div className="space-y-1 text-xs font-bold">
              <div className="flex justify-between gap-2">
                <span>Subtotal</span>
                <span className="shrink-0 whitespace-nowrap">{formatCurrency(cartTotal)}</span>
              </div>
              {discountValue > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Descuento</span>
                  <span className="shrink-0 whitespace-nowrap">-{formatCurrency(discountValue)}</span>
                </div>
              ) : null}
              {extraValue > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Agregado</span>
                  <span className="shrink-0 whitespace-nowrap">{formatCurrency(extraValue)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex justify-between text-sm font-black">
            <span>Total</span>
            <span className="shrink-0 whitespace-nowrap">{formatCurrency(orderTotal)}</span>
          </div>
        </div>
      ) : null}

      {printSections.thanks ? (
        <div className={`receipt-paper ${preview ? "mx-auto lg:mx-0" : ""}`}>
          <div className="receipt-thanks-layout">
            <img src="/ceeseburgito.jpeg" alt="Ceeseburguito" className="receipt-thanks-image" />
            <div className="receipt-thanks-copy">
              <p className="text-base font-black uppercase leading-tight">Muchas gracias</p>
              <p className="mt-1 text-xs font-bold">Que las disfrute</p>
              <p className="mt-1 text-sm font-black uppercase">Ceese Burger's</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

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
      id: editingCartSale?.id,
      createdAt: editingCartSale?.createdAt,
      date: editingCartSale?.date,
      client: orderName,
      detail: orderDetail,
      total: orderTotal,
      status: editingCartSale?.status,
      cashAmount: editingCartSale?.cashAmount,
      transferAmount: editingCartSale?.transferAmount,
      deliveryType,
      deliveryAddress,
      deliveryFee: deliveryFeeAmount,
      discountAmount: discountValue,
      extraAmount: extraValue,
      fulfillmentTime,
      orderItems: buildOrderItems(),
      quantity: cartUnits,
      productName,
    });

    if (!saved) {
      setIsPrinting(false);
      return;
    }

    try {
      await printTicket(
        buildTicketData({
          paperSize: receiptPaperSize,
          logoPath: receiptLogoPath,
          sections: printSections,
          client: orderName,
          detail: orderDetail,
          paymentLabel: "Pendiente",
          deliveryType,
          deliveryAddress,
          deliveryFee: deliveryFeeAmount,
          discountAmount: discountValue,
          extraAmount: extraValue,
          fulfillmentTime,
          items: buildOrderItems(),
          productTotal: cartTotal,
          total: orderTotal,
        }),
      );

      setIsPrinting(false);
      setIsReceiptOpen(false);
      setCartItems([]);
      setPrintSections(defaultPrintSections);
      setReceiptPaperSize("80mm");
      setIsAdvancedOpen(false);
      setDiscountAmount("");
      setExtraAmount("");
      setDeliveryType("retiro");
      setDeliveryAddress("");
      setDeliveryFee("");
      setFulfillmentTime("");
      setOrderName("");
      setOrderDetail("");
      setEditingCartSale(null);
    } catch (error) {
      setIsPrinting(false);
      window.alert(error instanceof Error ? error.message : "No fue posible imprimir el ticket ESC/POS.");
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col space-y-4 overflow-auto pr-1 lg:overflow-hidden">
      <div className="grid h-full min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
        <section className={`${shellCardClass} flex min-h-[26rem] flex-col overflow-hidden lg:min-h-0`}>
          <div className="flex flex-col gap-2 border-b border-rose-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-rose-500">Menu</p>
            </div>
            <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
              {activeCategoryItems.length} opciones
            </span>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-auto pr-1">
            <div>
              <h4 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-rose-500">{activeCategory.label}</h4>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {activeCategoryItems.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleProductClick(item)}
                    className="flex min-h-28 flex-col overflow-hidden rounded-[1.35rem] border border-rose-100 bg-rose-50/60 text-left transition hover:border-fuchsia-200 hover:bg-white"
                  >
                    <span className="block aspect-square w-full overflow-hidden bg-white">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-rose-50 text-rose-400">
                          <ImageOffIcon />
                          <span className="text-xs font-bold uppercase tracking-[0.14em]">Sin imagen</span>
                        </span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col justify-between p-4">
                      <span className="text-sm font-bold leading-5 text-rose-950">{item.name}</span>
                      <span className="mt-4 text-lg font-black text-fuchsia-700">{formatCurrency(item.price)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <footer data-print-hidden className="mt-4 shrink-0 rounded-[1.5rem] border border-white/70 bg-white/70 px-5 py-4 text-sm text-rose-700 shadow-[0_18px_50px_var(--app-shadow)] backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-rose-900">Finanzas Ceeseburgers C&K</p>
              <p>Resumen local de compras, ventas e inventario guardado en este dispositivo.</p>
            </div>
          </footer>
        </section>

        <aside className={`${shellCardClass} flex min-h-[26rem] flex-col overflow-hidden lg:h-full lg:min-h-0`}>
          <div className="space-y-3 border-b border-rose-100 py-4">
            {editingCartSale ? (
              <div className="rounded-[1.1rem] border border-fuchsia-100 bg-fuchsia-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-600">Editando venta</p>
                <p className="mt-1 truncate text-sm font-bold text-rose-950">{editingCartSale.client || editingCartSale.id}</p>
              </div>
            ) : null}
            <div className="rounded-[1.35rem] bg-gradient-to-r from-rose-50 to-fuchsia-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-rose-500">Total pedido</p>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                  {cartUnits} items
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-rose-950">{formatCurrency(cartTotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPrintSections(defaultPrintSections);
                setReceiptPaperSize("80mm");
                setIsAdvancedOpen(false);
                setIsReceiptOpen(true);
              }}
              disabled={cartItems.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PrintIcon />
              {editingCartSale ? "Actualizar e imprimir" : "Imprimir boleta"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto py-4 pr-1">
            {cartItems.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center rounded-[1.5rem] border border-dashed border-rose-200 bg-rose-50/60 px-5 text-center text-sm leading-6 text-rose-700">
                Selecciona productos del menu para comenzar a armar el pedido.
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <article key={item.id} className="group relative overflow-hidden rounded-[1.25rem] border border-rose-100 bg-white/70 p-4">
                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="absolute inset-y-0 right-0 z-10 flex w-16 items-center justify-center bg-gradient-to-l from-stone-950/85 via-stone-900/55 to-transparent text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 shadow-sm">
                        <XIcon />
                      </span>
                    </button>

                    <div className="flex items-start justify-between gap-3 pr-14">
                      <div>
                        <p className="font-bold leading-5 text-rose-950">{item.name}</p>
                        <p className="mt-1 text-sm text-rose-500">{formatCurrency(item.price)} c/u</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">
                          {item.quantity} unidad{item.quantity === 1 ? "" : "es"}
                        </p>
                      </div>
                      <p className="shrink-0 font-black text-fuchsia-700">{formatCurrency(item.price * item.quantity)}</p>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-rose-100 pt-3">
                      {item.customizations.slice(0, 3).map((customization, index) => {
                        const notes = getCustomizationNotes(customization);

                        return (
                          <div key={customization.id} className="rounded-[1rem] bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700">
                            <p className="font-black text-rose-900">Unidad {index + 1}</p>
                            <p className="mt-1">{notes.length > 0 ? notes.join(" · ") : "Sin cambios"}</p>
                          </div>
                        );
                      })}
                      {item.customizations.length > 3 ? (
                        <p className="text-xs font-semibold text-rose-500">+{item.customizations.length - 3} unidades mas</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {productModalItem && productModalCustomizations.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Configurar producto</p>
                <h3 className="text-2xl font-black text-rose-950">{productModalItem.name}</h3>
                <p className="mt-1 text-sm font-bold text-fuchsia-700">{formatCurrency(productModalItem.price)} c/u</p>
              </div>
              <button
                type="button"
                onClick={closeProductModal}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar configuracion de producto"
              >
                <XIcon />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-center gap-2">
              {["Cantidad", "Opciones", "Quitar"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setProductModalStep(index)}
                  className={`h-3 w-3 rounded-full transition ${
                    productModalStep >= index ? "bg-fuchsia-600" : "bg-rose-100"
                  }`}
                  aria-label={label}
                  title={label}
                />
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
              {productModalStep === 0 ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-rose-100 bg-rose-50">
                <div className="aspect-square max-h-72 w-full bg-white">
                  {productModalItem.image ? (
                    <img src={productModalItem.image} alt={productModalItem.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-rose-400">
                      <ImageOffIcon />
                      <span className="text-xs font-bold uppercase tracking-[0.14em]">Sin imagen</span>
                    </div>
                  )}
                </div>
                </div>
              ) : null}

              {productModalStep === 0 ? (
                <div className="rounded-[1.25rem] border border-rose-100 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Cantidad</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateProductModalQuantity(productModalQuantity - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-lg font-bold text-rose-700"
                    aria-label="Restar producto"
                  >
                    -
                  </button>
                  <span className="flex h-10 min-w-12 items-center justify-center rounded-full bg-rose-50 px-4 text-sm font-black text-rose-900">
                    {productModalQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateProductModalQuantity(productModalQuantity + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-lg font-bold text-rose-700"
                    aria-label="Sumar producto"
                  >
                    +
                  </button>
                </div>
                </div>
              ) : null}

              {productModalStep === 1 ? (
                <div className="space-y-3">
                  {!productModalItem.drinkOptions && !productModalItem.sauceOptions ? (
                    <div className="rounded-[1.25rem] border border-dashed border-rose-200 bg-rose-50/60 p-5 text-center text-sm font-semibold text-rose-700">
                      Este producto no tiene bebida ni salsa para elegir.
                    </div>
                  ) : null}
                  {productModalCustomizations.map((customization, index) => (
                    <div key={customization.id} className="rounded-[1.25rem] border border-rose-100 bg-white/80 p-4">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-rose-500">Unidad {index + 1}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {productModalItem.drinkOptions ? (
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Bebida</span>
                            <select
                              value={customization.drink}
                              onChange={(event) => updateProductModalCustomization(customization.id, { drink: event.target.value })}
                              className="mt-2 w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                            >
                              {productModalItem.drinkOptions.map((drink) => (
                                <option key={drink} value={drink}>
                                  {drink}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {productModalItem.sauceOptions ? (
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Salsa</span>
                            <select
                              value={customization.sauce}
                              onChange={(event) => updateProductModalCustomization(customization.id, { sauce: event.target.value })}
                              className="mt-2 w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                            >
                              {productModalItem.sauceOptions.map((sauce) => (
                                <option key={sauce} value={sauce}>
                                  {sauce}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {productModalStep === 2 ? (
                <div className="space-y-3">
                  {!productModalItem.removableIngredients && !productModalCustomizations.some((customization) => customization.familyBurgers) ? (
                    <div className="rounded-[1.25rem] border border-dashed border-rose-200 bg-rose-50/60 p-5 text-center text-sm font-semibold text-rose-700">
                      Este producto no tiene ingredientes configurables.
                    </div>
                  ) : null}
                  {productModalCustomizations.map((customization, index) => (
                    <div key={customization.id} className="space-y-3 rounded-[1.25rem] border border-rose-100 bg-white/80 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-500">Unidad {index + 1}</p>
                      {productModalItem.removableIngredients ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Sin ingredientes</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {productModalItem.removableIngredients.map((ingredient) => {
                              const isRemoved = customization.removedIngredients.includes(ingredient);

                              return (
                                <button
                                  key={ingredient}
                                  type="button"
                                  onClick={() => toggleProductModalRemovedIngredient(customization.id, ingredient)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                    isRemoved ? "border-red-200 bg-red-50 text-red-700" : "border-rose-200 bg-white text-rose-600"
                                  }`}
                                >
                                  {ingredient}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {customization.familyBurgers ? (
                        <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Sin por hamburguesa</p>
                          {customization.familyBurgers.map((burger) => (
                    <div key={burger.id} className="rounded-[1rem] border border-rose-100 bg-rose-50/50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-600">{burger.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {burger.removableIngredients.map((ingredient) => {
                          const isRemoved = burger.removedIngredients.includes(ingredient);

                          return (
                            <button
                              key={ingredient}
                              type="button"
                                      onClick={() => toggleProductModalFamilyBurgerRemovedIngredient(customization.id, burger.id, ingredient)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                isRemoved ? "border-red-200 bg-red-50 text-red-700" : "border-rose-200 bg-white text-rose-600"
                              }`}
                            >
                              {ingredient}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                        </div>
                      ) : null}
                </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-rose-100 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={productModalStep === 0 ? closeProductModal : goToPreviousProductModalStep}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                {productModalStep === 0 ? "Cancelar" : "Atras"}
              </button>
              <button
                type="button"
                onClick={productModalStep === 2 ? confirmProductModal : goToNextProductModalStep}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700"
              >
                {productModalStep === 2 ? `Agregar ${formatCurrency(productModalItem.price * productModalQuantity)}` : "Siguiente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isReceiptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Previsualizacion</p>
                <h3 className="text-xl font-bold text-rose-950">Boleta {receiptPaperSize}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPrintSections(defaultPrintSections);
                  setReceiptPaperSize("80mm");
                  setIsAdvancedOpen(false);
                  setDiscountAmount("");
                  setExtraAmount("");
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
                <div data-receipt-preview className="space-y-4" style={receiptPreviewStyle}>
                  {renderReceiptPapers(true)}
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
                            onClick={() => handleDeliveryTypeChange(option.value as DeliveryType)}
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
                    <div className="space-y-3">
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
                          {discountValue > 0 ? (
                            <div className="mb-2 flex justify-between gap-3">
                              <span>Descuento</span>
                              <span className="font-bold text-rose-600">-{formatCurrency(discountValue)}</span>
                            </div>
                          ) : null}
                          {extraValue > 0 ? (
                            <div className="mb-2 flex justify-between gap-3">
                              <span>Agregado</span>
                              <span className="font-bold text-emerald-700">{formatCurrency(extraValue)}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between gap-3">
                            <span>Delivery</span>
                            <span className="font-bold">{formatCurrency(deliveryFeeAmount)}</span>
                          </div>
                        </div>
                      ) : discountValue > 0 || extraValue > 0 ? (
                        <div className="border-t border-rose-100 pt-2">
                          {discountValue > 0 ? (
                            <div className="flex justify-between gap-3">
                              <span>Descuento</span>
                              <span className="font-bold text-rose-600">-{formatCurrency(discountValue)}</span>
                            </div>
                          ) : null}
                          {extraValue > 0 ? (
                            <div className="flex justify-between gap-3">
                              <span>Agregado</span>
                              <span className="font-bold text-emerald-700">{formatCurrency(extraValue)}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-rose-100 bg-white/70 p-4">
                    <button
                      type="button"
                      onClick={() => setIsAdvancedOpen((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Ajustes avanzados</span>
                      <span className="text-sm font-black text-fuchsia-700">{isAdvancedOpen ? "-" : "+"}</span>
                    </button>

                    {isAdvancedOpen ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Descuento</span>
                          <input
                            value={discountAmount}
                            onChange={(event) => setDiscountAmount(event.target.value.replace(/\D/g, ""))}
                            inputMode="numeric"
                            className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                            placeholder="0"
                          />
                          {discountValue > 0 ? (
                            <span className="block text-xs font-semibold text-rose-600">
                              Total productos con descuento: {formatCurrency(discountedCartTotal)}
                            </span>
                          ) : null}
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Agregar dinero</span>
                          <input
                            value={extraAmount}
                            onChange={(event) => setExtraAmount(event.target.value.replace(/\D/g, ""))}
                            inputMode="numeric"
                            className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                            placeholder="0"
                          />
                          {extraValue > 0 ? (
                            <span className="block text-xs font-semibold text-emerald-700">
                              Extra sumado: {formatCurrency(extraValue)}
                            </span>
                          ) : null}
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-rose-100 pt-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
                    <div className="grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                      {(["80mm", "56mm"] as ReceiptPaperSize[]).map((paperSize) => (
                        <button
                          key={paperSize}
                          type="button"
                          onClick={() => setReceiptPaperSize(paperSize)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                            receiptPaperSize === paperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                          }`}
                        >
                          {paperSize}
                        </button>
                      ))}
                    </div>
                  </div>
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
