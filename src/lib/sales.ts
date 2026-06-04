import type { Sale } from "../types";

export const getSaleDeliveryFee = (sale: Pick<Sale, "deliveryType" | "deliveryFee">) =>
  sale.deliveryType === "delivery" ? sale.deliveryFee ?? 0 : 0;

export const getSaleDiscountAmount = (sale: Pick<Sale, "discountAmount">) => sale.discountAmount ?? 0;

export const getSaleExtraAmount = (sale: Pick<Sale, "extraAmount">) => sale.extraAmount ?? 0;

export const getSaleNetTotal = (sale: Pick<Sale, "total" | "deliveryType" | "deliveryFee">) =>
  Math.max(0, sale.total - getSaleDeliveryFee(sale));

export const getSaleBusinessIncomeTotal = (
  sale: Pick<Sale, "total" | "deliveryType" | "deliveryFee" | "deliveryPaymentMethod">,
) => getSaleNetTotal(sale) + (sale.deliveryPaymentMethod === "nosotros" ? getSaleDeliveryFee(sale) : 0);

export const getSaleCashIncome = (
  sale: Pick<Sale, "total" | "status" | "cashAmount" | "deliveryType" | "deliveryFee" | "deliveryPaymentMethod">,
) => {
  if (sale.status === "efectivo") return getSaleBusinessIncomeTotal(sale);
  if (sale.status === "mixto") return sale.cashAmount ?? 0;
  return 0;
};

export const getSaleDebitIncome = (
  sale: Pick<Sale, "total" | "status" | "transferAmount" | "deliveryType" | "deliveryFee" | "deliveryPaymentMethod">,
) => {
  if (sale.status === "transferencia") return getSaleBusinessIncomeTotal(sale);
  if (sale.status === "mixto") return sale.transferAmount ?? 0;
  return 0;
};

export const getSaleDeliveryCashToDebitMovement = (
  sale: Pick<Sale, "status" | "deliveryType" | "deliveryFee" | "deliveryPaymentMethod">,
) =>
  sale.status === "transferencia" && sale.deliveryType === "delivery" && sale.deliveryPaymentMethod === "efectivo"
    ? getSaleDeliveryFee(sale)
    : 0;

export const getSaleDeliveryDebitToCashMovement = (
  sale: Pick<Sale, "status" | "deliveryType" | "deliveryFee" | "deliveryPaymentMethod">,
) =>
  sale.status === "efectivo" && sale.deliveryType === "delivery" && sale.deliveryPaymentMethod === "debito"
    ? getSaleDeliveryFee(sale)
    : 0;
