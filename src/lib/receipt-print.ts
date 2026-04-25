const RECEIPT_PRINT_STYLE_ID = "receipt-print-page-style";

export type ReceiptPaperSize = "80mm" | "58mm";

const receiptPaperSidePadding: Record<ReceiptPaperSize, string> = {
  "80mm": "3.5mm",
  "58mm": "2.5mm",
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
      --receipt-side-padding: ${receiptPaperSidePadding[paperSize]};
    }
  `;

  document.head.appendChild(style);

  return () => {
    style.remove();
  };
};
