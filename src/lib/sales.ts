import type { Sale } from "../types";

export const getSaleDeliveryFee = (sale: Pick<Sale, "deliveryType" | "deliveryFee">) =>
  sale.deliveryType === "delivery" ? sale.deliveryFee ?? 0 : 0;

export const getSaleDiscountAmount = (sale: Pick<Sale, "discountAmount">) => sale.discountAmount ?? 0;

export const getSaleNetTotal = (sale: Pick<Sale, "total" | "deliveryType" | "deliveryFee">) =>
  Math.max(0, sale.total - getSaleDeliveryFee(sale));
