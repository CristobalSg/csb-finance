# ESC/POS Printer Server

Servidor local para imprimir tickets con comandos ESC/POS nativos.

## Instalacion

```bash
pnpm --dir printer-server install
```

## Windows con impresora USB instalada

En Windows la forma recomendada es enviar ESC/POS RAW por el spooler usando el nombre exacto de la impresora.

Puedes dejar estos valores en `printer-server/.env` copiando `printer-server/.env.example`, o pasarlos antes de iniciar el servidor como en el script `.bat`.

Primero lista impresoras:

```bash
curl http://127.0.0.1:3001/printers
```

Luego levanta el servidor con el nombre exacto:

```bat
set PRINTER_CONNECTION=windows
set PRINTER_NAME=Nombre exacto de tu impresora
pnpm printer:dev
```

Ejemplo:

```bat
set PRINTER_CONNECTION=windows
set PRINTER_NAME=POS-80
pnpm printer:dev
```

Para que el frontend apunte al servidor local, copia `.env.example` a `.env` en la raiz del proyecto. El valor por defecto usado por la app tambien es `http://localhost:3001`.

Para agregar espacio antes de cada boleta/ticket, ajusta `RECEIPT_TOP_FEED_LINES` en `printer-server/.env`. Por ejemplo, `RECEIPT_TOP_FEED_LINES=1` avanza una linea antes de comenzar a imprimir.

## USB directo con libusb

```bash
pnpm printer:dev
```

En Windows este modo puede fallar con `LIBUSB_ERROR_NOT_SUPPORTED` si la impresora esta tomada por el driver de Windows. En ese caso usa el modo `windows` de arriba.

Opcionalmente fija vendor/product id:

```bash
PRINTER_USB_VENDOR_ID=04b8 PRINTER_USB_PRODUCT_ID=0202 pnpm printer:dev
```

## Red

```bash
PRINTER_CONNECTION=network PRINTER_HOST=192.168.1.50 PRINTER_PORT=9100 pnpm printer:dev
```

El frontend envia tickets a `http://localhost:3001/print`. Puedes cambiarlo con:

```bash
VITE_PRINTER_SERVER_URL=http://localhost:3001 pnpm dev
```
