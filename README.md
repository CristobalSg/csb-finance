# Finanzas Food Cart

Aplicacion web para gestionar un emprendimiento de comida con **React + TypeScript + Vite + Tailwind CSS** y persistencia local en **IndexedDB**.

Incluye:

- Dashboard con ingresos, egresos, ganancia neta y caja esperada.
- Registro de compras con calculo automatico de totales.
- Registro de ventas con estados de pago.
- Modulo de inventario con valorizacion automatica.
- Exportacion de respaldos en JSON y modulos en CSV.
- Persistencia local para usar la app dia a dia sin servidor.

## Scripts

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm lint
```

## Variables de entorno

Para desarrollo local copia `.env.example` a `.env` en la raiz del proyecto. Ese archivo define el servidor local de impresion que usa Vite:

```bash
VITE_PRINTER_SERVER_URL=http://localhost:3001
VITE_INTERNAL_SERVER_URL=http://localhost:3001
```

Para el servidor ESC/POS copia `printer-server/.env.example` a `printer-server/.env`. En Windows con una impresora instalada como `POS-80`, los valores clave son:

```bash
PRINTER_CONNECTION=windows
PRINTER_NAME=POS-80
```

## Docker

Levanta la aplicacion web en `http://localhost:8080`:

```bash
docker compose up --build
```

Tambien puedes construir y correr solo la imagen del frontend:

```bash
docker build -t csb-finance .
docker run --rm -p 8080:80 csb-finance
```

El servidor de impresora ESC/POS es opcional. Para levantarlo junto al frontend usa el perfil `printer`:

```bash
docker compose --profile printer up --build
```

Para impresora de red:

```bash
PRINTER_CONNECTION=network PRINTER_HOST=192.168.1.50 docker compose --profile printer up --build
```

El frontend queda servido por nginx y el healthcheck queda disponible en `http://localhost:8080/healthz`.

## Estructura

```text
src/
  App.tsx
  types.ts
  lib/
    date.ts
    db.ts
    format.ts
    id.ts
  index.css
  main.tsx
public/
  manifest.json
  logo.svg
  icons/
Dockerfile
nginx.conf
vercel.json
```

## Uso diario

- Las compras, ventas e inventario se guardan localmente en el navegador.
- La fecha se genera automaticamente al crear registros.
- El dashboard se recalcula en tiempo real.
- Puedes exportar respaldo completo en JSON o cada modulo en CSV.

## Scripts

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm lint
```
