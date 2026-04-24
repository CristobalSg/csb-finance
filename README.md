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
