import type { SupabaseOrder, SupabaseOrderStatus } from "../types";

const ordersServerUrl =
  import.meta.env.VITE_INTERNAL_SERVER_URL ?? import.meta.env.VITE_PRINTER_SERVER_URL ?? "http://localhost:3001";

const parseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
};

export const fetchOrders = async () => {
  const response = await fetch(`${ordersServerUrl}/orders`);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No fue posible cargar los pedidos."));
  }

  const payload = (await response.json()) as { orders?: SupabaseOrder[] };
  return payload.orders ?? [];
};

export const updateOrderStatus = async (id: string, status: SupabaseOrderStatus) => {
  const response = await fetch(`${ordersServerUrl}/orders/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No fue posible actualizar el estado del pedido."));
  }

  const payload = (await response.json()) as { order?: SupabaseOrder };

  if (!payload.order) {
    throw new Error("El servidor no devolvio el pedido actualizado.");
  }

  return payload.order;
};
