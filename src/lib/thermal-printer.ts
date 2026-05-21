import type { TicketPrintJob } from "./thermal-ticket";

const printerServerUrl = import.meta.env.VITE_PRINTER_SERVER_URL ?? "http://localhost:3001";

export const printTicket = async (ticket: TicketPrintJob) => {
  const response = await fetch(`${printerServerUrl}/print`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ticket),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "No fue posible imprimir el ticket ESC/POS.");
  }
};
