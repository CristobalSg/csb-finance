FROM node:22-bookworm-slim

WORKDIR /app

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV PRINTER_SERVER_HOST="0.0.0.0"

RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ libusb-1.0-0 libusb-1.0-0-dev make pkg-config python3 udev \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.28.1 --activate

COPY printer-server/package.json printer-server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY printer-server/server.js ./
COPY public/receipt-logo-thermal.png /public/receipt-logo-thermal.png
COPY public/Logo_ceese_horizontal_png.png /public/Logo_ceese_horizontal_png.png

ENV RECEIPT_LOGO_PATH="/public/receipt-logo-thermal.png"

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "start"]
