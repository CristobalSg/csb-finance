import cors from "cors";
import express from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
const escpos = require("escpos");
const __dirname = dirname(fileURLToPath(import.meta.url));

const patchEscposUsbEvents = () => {
  const Module = require("node:module");
  const escposUsbRequire = createRequire(require.resolve("escpos-usb"));
  const usbPackage = escposUsbRequire("usb");
  const usbPackagePath = escposUsbRequire.resolve("usb");

  if (!usbPackage.on && usbPackage.usb?.on) {
    usbPackage.on = usbPackage.usb.on.bind(usbPackage.usb);
  }

  if (!usbPackage.off && usbPackage.usb?.off) {
    usbPackage.off = usbPackage.usb.off.bind(usbPackage.usb);
  }

  if (!usbPackage.removeListener && usbPackage.usb?.removeListener) {
    usbPackage.removeListener = usbPackage.usb.removeListener.bind(usbPackage.usb);
  }

  if (!usbPackage.removeAllListeners && usbPackage.usb?.removeAllListeners) {
    usbPackage.removeAllListeners = usbPackage.usb.removeAllListeners.bind(usbPackage.usb);
  }

  const patchedUsbPackage = {
    ...usbPackage,
    on: usbPackage.on,
    off: usbPackage.off,
    removeListener: usbPackage.removeListener,
    removeAllListeners: usbPackage.removeAllListeners,
  };

  if (require.cache[usbPackagePath]) {
    require.cache[usbPackagePath].exports = patchedUsbPackage;
  }

  const originalLoad = Module._load;

  if (!Module._escposUsbPatched) {
    Module._load = function patchedUsbLoad(request, parent, isMain) {
      if (request === "usb" && parent?.filename?.includes("escpos-usb")) {
        return patchedUsbPackage;
      }

      return originalLoad.apply(this, [request, parent, isMain]);
    };
    Module._escposUsbPatched = true;
  }
};

patchEscposUsbEvents();

escpos.USB = require("escpos-usb");
escpos.Network = require("escpos-network");

const app = express();
const port = Number(process.env.PRINTER_SERVER_PORT || 3001);
const host = process.env.PRINTER_SERVER_HOST || "127.0.0.1";
const publicAssetsPath = resolve(__dirname, "../public");
const receiptLogoPath = process.env.RECEIPT_LOGO_PATH || resolve(__dirname, "../public/receipt-logo-thermal.png");
const printerLineSpacing = Number(process.env.PRINTER_LINE_SPACING || 24);
const printerCutFeedLines = Number(process.env.PRINTER_CUT_FEED_LINES || 4);
const printerEventCutFeedLines = Number(process.env.PRINTER_EVENT_CUT_FEED_LINES || 4);
const receiptLogoWidth80mm = Number(process.env.RECEIPT_LOGO_WIDTH_80MM || 384);
const receiptLogoWidth56mm = Number(process.env.RECEIPT_LOGO_WIDTH_56MM || 256);
let receiptLogoPromise;
const receiptLogoPromises = new Map();
let receiptLogoLogged = false;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

const getColumns = (paperSize) => (paperSize === "56mm" ? 32 : 48);

const getReceiptLogoWidth = (paperSize) => {
  const configuredWidth = paperSize === "56mm" ? receiptLogoWidth56mm : receiptLogoWidth80mm;
  return Number.isFinite(configuredWidth) && configuredWidth > 0 ? Math.floor(configuredWidth) : undefined;
};

const getReceiptLogoPath = (logoPath) => {
  if (!logoPath) {
    return receiptLogoPath;
  }

  const resolvedLogoPath = resolve(publicAssetsPath, logoPath.replace(/^\/+/, ""));

  const relativeLogoPath = relative(publicAssetsPath, resolvedLogoPath);

  if (relativeLogoPath.startsWith("..") || relativeLogoPath === "" || isAbsolute(relativeLogoPath)) {
    return receiptLogoPath;
  }

  return resolvedLogoPath;
};

const loadReceiptLogo = (logoPath) => {
  const resolvedLogoPath = getReceiptLogoPath(logoPath);

  if (process.env.PRINT_RECEIPT_LOGO === "false" || !existsSync(resolvedLogoPath)) {
    if (!receiptLogoLogged) {
      console.warn(`Logo de boleta desactivado o no encontrado: ${resolvedLogoPath}`);
      receiptLogoLogged = true;
    }

    return Promise.resolve(null);
  }

  receiptLogoPromise = receiptLogoPromises.get(resolvedLogoPath);

  if (receiptLogoPromise) {
    return receiptLogoPromise;
  }

  receiptLogoPromise = new Promise((resolveImage, reject) => {
    escpos.Image.load(resolvedLogoPath, (image) => {
      if (image instanceof Error) {
        reject(image);
        return;
      }

      if (image && !receiptLogoLogged) {
        console.log(`Logo de boleta cargado: ${resolvedLogoPath} (${image.size.width}x${image.size.height})`);
        receiptLogoLogged = true;
      }

      resolveImage(image || null);
    });
  }).catch((error) => {
    console.warn(`No se pudo cargar el logo de boleta: ${error.message}`);
    return null;
  });
  receiptLogoPromises.set(resolvedLogoPath, receiptLogoPromise);

  return receiptLogoPromise;
};

const resizeReceiptLogo = (logo, maxWidth) => {
  if (!logo || !maxWidth || logo.size.width <= maxWidth) {
    return logo;
  }

  const width = maxWidth;
  const height = Math.max(1, Math.round((logo.size.height * width) / logo.size.width));
  const data = new Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(logo.size.height - 1, Math.floor((y * logo.size.height) / height));

    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(logo.size.width - 1, Math.floor((x * logo.size.width) / width));
      data[y * width + x] = logo.data[sourceY * logo.size.width + sourceX];
    }
  }

  const resizedLogo = Object.create(Object.getPrototypeOf(logo));
  resizedLogo.data = data;
  resizedLogo.pixels = {
    shape: [width, height, logo.size.colors],
  };

  return resizedLogo;
};

class WindowsSpoolDevice {
  constructor(printerName) {
    if (!printerName) {
      throw new Error("Falta PRINTER_NAME. En Windows usa: set PRINTER_NAME=Nombre exacto de la impresora");
    }

    this.printerName = printerName;
    this.chunks = [];
  }

  open(callback) {
    callback?.(null, this);
    return this;
  }

  write(data, callback) {
    this.chunks.push(Buffer.from(data));
    callback?.(null);
    return this;
  }

  async close(callback) {
    const payload = Buffer.concat(this.chunks);
    const filePath = join(tmpdir(), `csb-ticket-${Date.now()}.bin`);

    try {
      await writeFile(filePath, payload);
      await sendRawFileToWindowsPrinter(this.printerName, filePath);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    } finally {
      await unlink(filePath).catch(() => {});
      this.chunks = [];
    }

    return this;
  }
}

const sendRawFileToWindowsPrinter = (printerName, filePath) =>
  new Promise((resolve, reject) => {
    const script = `
$printerName = $env:CSB_PRINTER_NAME
$filePath = $env:CSB_PRINT_FILE
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

  public static bool SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "CSB ESC/POS Ticket";
    di.pDataType = "RAW";

    if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
    if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
    if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }

    IntPtr unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);
    int written = 0;
    bool success = WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out written);
    Marshal.FreeCoTaskMem(unmanagedBytes);

    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    return success && written == bytes.Length;
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes($filePath)
if (-not [RawPrinterHelper]::SendBytes($printerName, $bytes)) {
  throw "No se pudo enviar RAW a la impresora '$printerName'"
}
`;

    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: {
          ...process.env,
          CSB_PRINTER_NAME: printerName,
          CSB_PRINT_FILE: filePath,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }

        resolve();
      },
    );
  });

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
  printer.text(normalizeText(value));
};

const writeSeparator = (printer, columns) => {
  writeLine(printer, "-".repeat(columns));
};

const setBold = (printer, enabled) => {
  printer.style(enabled ? "b" : "normal");
};

const setTicketLineSpacing = (printer, lineSpacing = printerLineSpacing) => {
  if (Number.isFinite(lineSpacing) && lineSpacing >= 0 && lineSpacing <= 255) {
    printer.lineSpace(lineSpacing);
  }
};

const writeCentered = (printer, value, columns, bold = false) => {
  printer.align("lt");
  setBold(printer, bold);
  writeLine(printer, centerText(value, columns));
  setBold(printer, false);
};

const writeCenteredWrapped = (printer, value, columns, bold = false, lineColumns = columns) => {
  printer.align("lt");
  setBold(printer, bold);
  for (const line of splitText(value, lineColumns)) {
    writeLine(printer, centerText(line, columns));
  }
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

const printReceiptLogo = async (printer, paperSize, logoPath) => {
  const logo = await loadReceiptLogo(logoPath);

  if (!logo) {
    return;
  }

  const printableLogo = resizeReceiptLogo(logo, getReceiptLogoWidth(paperSize));
  printer.align("ct");
  await printer.image(printableLogo, "d24");
  printer.align("lt");
  setTicketLineSpacing(printer);
  printer.feed(1);
};

const printBoleta = async (printer, section, columns, paperSize, logoPath) => {
  await printReceiptLogo(printer, paperSize, logoPath);
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

const printEventTicket = async (printer, section, columns, paperSize, logoPath) => {
  await printReceiptLogo(printer, paperSize, logoPath);
  setTicketLineSpacing(printer, section.lineSpacing);
  writeCentered(printer, "Ceeseburger's Labranza", columns);
  writeSeparator(printer, columns);

  if (section.studentName) {
    writeWrapped(printer, `Nombre: ${section.studentName}`, columns);
  }

  writeSeparator(printer, columns);
  setBold(printer, true);
  writeWrapped(printer, `1 x ${section.burgerName || "Hamburguesa"}`, columns);
  setBold(printer, false);

  if (section.removedIngredients?.length) {
    writeWrapped(printer, `Sin: ${section.removedIngredients.join(", ")}`, columns, "  ");
  } else {
    writeWrapped(printer, "Sin cambios de ingredientes", columns, "  ");
  }

  writeSeparator(printer, columns);
  writeLine(printer);
  writeCenteredWrapped(printer, section.message || "Feliz Día del Estudiante", columns, true, Math.max(20, columns - 8));
  writeLine(printer);
};

const createDevice = () => {
  const connection = process.env.PRINTER_CONNECTION || (process.platform === "win32" ? "windows" : "usb");

  if (connection === "network") {
    const host = process.env.PRINTER_HOST;
    const networkPort = Number(process.env.PRINTER_PORT || 9100);

    if (!host) {
      throw new Error("Falta PRINTER_HOST para impresora de red.");
    }

    return new escpos.Network(host, networkPort);
  }

  if (connection === "windows") {
    return new WindowsSpoolDevice(process.env.PRINTER_NAME);
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
  setTicketLineSpacing(printer);

  for (const [index, section] of job.sections.entries()) {
    if (section.type === "comanda") {
      printComanda(printer, section, columns);
    } else if (section.type === "boleta") {
      await printBoleta(printer, section, columns, job.paperSize, job.logoPath);
    } else if (section.type === "gracias") {
      printThanks(printer, section, columns);
    } else if (section.type === "cierre-diario") {
      printDailyReport(printer, section, columns);
    } else if (section.type === "evento") {
      await printEventTicket(printer, section, columns, job.paperSize, job.logoPath);
    }

    const configuredCutFeedLines = section.type === "evento" ? printerEventCutFeedLines : printerCutFeedLines;
    printer.cut(undefined, Number.isFinite(configuredCutFeedLines) ? configuredCutFeedLines : 1);

    if (index < job.sections.length - 1) {
      printer.feed(1);
    }
  }

  printer.close();
};

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/printers", (_request, response) => {
  if (process.platform !== "win32") {
    response.status(400).json({ error: "Listado disponible solo en Windows." });
    return;
  }

  execFile(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"],
    (error, stdout, stderr) => {
      if (error) {
        response.status(500).send(stderr || error.message);
        return;
      }

      response.json({
        printers: stdout
          .split(/\r?\n/)
          .map((name) => name.trim())
          .filter(Boolean),
      });
    },
  );
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
