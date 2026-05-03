import cors from "cors";
import express from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const escpos = require("escpos");

escpos.USB = require("escpos-usb");
escpos.Network = require("escpos-network");

const app = express();
const port = Number(process.env.PRINTER_SERVER_PORT || 3001);
const host = process.env.PRINTER_SERVER_HOST || "127.0.0.1";

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

const getColumns = (paperSize) => (paperSize === "56mm" ? 32 : 48);

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7EñÑ]/g, "");

const formatCurrency = (value = 0) => `$${Math.round(Number(value) || 0).toLocaleString("es-CL")}`;

const truncate = (value, maxLength) => {
  const text = normalizeText(value);
  return text.length > maxLength ? text.slice(0, Math.max(0, maxLength - 1)).trimEnd() : text;
};

const centerText = (value, columns) => {
  const text = truncate(value, columns);
  const leftPadding = Math.max(0, Math.floor((columns - text.length) / 2));
  return `${" ".repeat(leftPadding)}${text}`;
};

const splitText = (value, columns) => {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= columns) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
};

const twoColumnLine = (left, right, columns) => {
  const normalizedRight = normalizeText(right);
  const rightWidth = normalizedRight.length;
  const leftWidth = Math.max(1, columns - rightWidth - 1);
  const normalizedLeft = truncate(left, leftWidth);
  const spacing = Math.max(1, columns - normalizedLeft.length - rightWidth);
  return `${normalizedLeft}${" ".repeat(spacing)}${normalizedRight}`;
};

const writeLine = (printer, value = "") => {
  printer.text(`${normalizeText(value)}\n`);
};

const writeSeparator = (printer, columns) => {
  writeLine(printer, "-".repeat(columns));
};

const setBold = (printer, enabled) => {
  printer.style(enabled ? "b" : "normal");
};

const writeCentered = (printer, value, columns, bold = false) => {
  printer.align("lt");
  setBold(printer, bold);
  writeLine(printer, centerText(value, columns));
  setBold(printer, false);
};

const writeWrapped = (printer, value, columns, indent = "") => {
  for (const line of splitText(value, columns - indent.length)) {
    writeLine(printer, `${indent}${line}`);
  }
};

const printItems = (printer, items, columns, showPrices) => {
  for (const item of items || []) {
    const left = `${item.qty || 1} x ${item.name || "Item"}`;
    const right = showPrices && typeof item.price === "number" ? formatCurrency(item.price) : "";

    setBold(printer, true);
    if (right) {
      writeLine(printer, twoColumnLine(left, right, columns));
    } else {
      writeWrapped(printer, left, columns);
    }
    setBold(printer, false);

    for (const note of item.notes || []) {
      writeWrapped(printer, note, columns, "  ");
    }
  }
};

const printComanda = (printer, section, columns) => {
  writeCentered(printer, section.title || "Comanda", columns, true);
  writeCentered(printer, section.date || new Date().toLocaleString("es-CL"), columns);
  writeLine(printer);
  writeCentered(printer, section.heading || "Ahora", columns, true);
  writeSeparator(printer, columns);

  for (const line of section.meta || []) {
    writeWrapped(printer, line, columns);
  }

  writeSeparator(printer, columns);
  printItems(printer, section.items, columns, false);

  if (section.summary?.length) {
    writeSeparator(printer, columns);
    for (const line of section.summary) {
      writeWrapped(printer, line, columns);
    }
  }
};

const printBoleta = (printer, section, columns) => {
  writeCentered(printer, section.businessName || "Ceese Burger's", columns, true);
  writeCentered(printer, section.title || "Boleta", columns);
  writeCentered(printer, section.date || new Date().toLocaleString("es-CL"), columns);
  writeSeparator(printer, columns);

  for (const line of section.meta || []) {
    writeWrapped(printer, line, columns);
  }

  writeSeparator(printer, columns);
  printItems(printer, section.items, columns, true);
  writeSeparator(printer, columns);

  for (const line of section.totals || []) {
    const value = `${line.negative ? "-" : ""}${formatCurrency(line.value)}`;
    writeLine(printer, twoColumnLine(line.label, value, columns));
  }

  setBold(printer, true);
  writeLine(printer, twoColumnLine("Total", formatCurrency(section.total), columns));
  setBold(printer, false);
};

const printThanks = (printer, section, columns) => {
  writeLine(printer);
  for (const line of section.lines || ["Muchas gracias"]) {
    writeCentered(printer, line, columns, true);
  }
  writeLine(printer);
};

const printDailyReport = (printer, section, columns) => {
  writeCentered(printer, section.title || "Cierre diario", columns, true);
  writeCentered(printer, section.businessName || "Ceese Burger's", columns);
  writeCentered(printer, section.dateRange || "", columns);
  writeSeparator(printer, columns);

  for (const line of section.summary || []) {
    const value = line.label === "Ventas" ? String(line.value) : formatCurrency(line.value);
    writeLine(printer, twoColumnLine(line.label, value, columns));
  }

  writeSeparator(printer, columns);
  setBold(printer, true);
  writeLine(printer, twoColumnLine("Total cobrado", formatCurrency(section.totalCollected), columns));
  writeLine(printer, twoColumnLine("Total ventas", formatCurrency(section.totalSales), columns));
  setBold(printer, false);

  if (section.sales?.length) {
    writeSeparator(printer, columns);
    printItems(printer, section.sales, columns, true);
  }
};

const createDevice = () => {
  const connection = process.env.PRINTER_CONNECTION || "usb";

  if (connection === "network") {
    const host = process.env.PRINTER_HOST;
    const networkPort = Number(process.env.PRINTER_PORT || 9100);

    if (!host) {
      throw new Error("Falta PRINTER_HOST para impresora de red.");
    }

    return new escpos.Network(host, networkPort);
  }

  const vendorId = process.env.PRINTER_USB_VENDOR_ID ? Number.parseInt(process.env.PRINTER_USB_VENDOR_ID, 16) : undefined;
  const productId = process.env.PRINTER_USB_PRODUCT_ID ? Number.parseInt(process.env.PRINTER_USB_PRODUCT_ID, 16) : undefined;

  return vendorId && productId ? new escpos.USB(vendorId, productId) : new escpos.USB();
};

const openDevice = (device) =>
  new Promise((resolve, reject) => {
    device.open((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const printEscpos = async (job) => {
  if (!job?.sections?.length) {
    throw new Error("El ticket no contiene secciones para imprimir.");
  }

  const device = createDevice();
  await openDevice(device);

  const printer = new escpos.Printer(device, { encoding: process.env.PRINTER_ENCODING || "CP850" });
  const columns = getColumns(job.paperSize);

  printer.font("a");
  printer.align("lt");

  for (const [index, section] of job.sections.entries()) {
    if (section.type === "comanda") {
      printComanda(printer, section, columns);
    } else if (section.type === "boleta") {
      printBoleta(printer, section, columns);
    } else if (section.type === "gracias") {
      printThanks(printer, section, columns);
    } else if (section.type === "cierre-diario") {
      printDailyReport(printer, section, columns);
    }

    printer.feed(3);
    printer.cut();

    if (index < job.sections.length - 1) {
      printer.feed(1);
    }
  }

  printer.close();
};

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/print", async (request, response) => {
  try {
    await printEscpos(request.body);
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).send(error instanceof Error ? error.message : "No fue posible imprimir.");
  }
});

app.listen(port, host, () => {
  console.log(`ESC/POS printer server listening on http://${host}:${port}`);
});
