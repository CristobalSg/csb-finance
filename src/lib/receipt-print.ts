const RECEIPT_PRINT_STYLE_ID = "receipt-print-page-style";

export type ReceiptPaperSize = "80mm" | "56mm";

const receiptPaperPadding: Record<ReceiptPaperSize, { left: string; right: string }> = {
  "80mm": { left: "3.5mm", right: "3.5mm" },
  "56mm": { left: "4mm", right: "4mm" },
};

export const setupReceiptPrintPage = (paperSize: ReceiptPaperSize = "80mm") => {
  document.getElementById(RECEIPT_PRINT_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = RECEIPT_PRINT_STYLE_ID;
  style.media = "print";
  style.textContent = `
    @page {
      size: ${paperSize} 297mm;
      margin: 0;
    }

    @page receipt {
      size: ${paperSize} 297mm;
      margin: 0;
    }

    body.printing-receipt {
      --receipt-width: ${paperSize};
      --receipt-left-padding: ${receiptPaperPadding[paperSize].left};
      --receipt-right-padding: ${receiptPaperPadding[paperSize].right};
    }
  `;

  document.head.appendChild(style);

  return () => {
    style.remove();
  };
};
