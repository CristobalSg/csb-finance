# ESC/POS Printer Server

Servidor local para imprimir tickets con comandos ESC/POS nativos.

## Instalacion

```bash
pnpm --dir printer-server install
```

## USB

```bash
pnpm printer:dev
```

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
