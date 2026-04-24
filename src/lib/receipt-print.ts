const RECEIPT_PRINT_STYLE_ID = "receipt-print-page-style";

export const setupReceiptPrintPage = () => {
  document.getElementById(RECEIPT_PRINT_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = RECEIPT_PRINT_STYLE_ID;
  style.media = "print";
  style.textContent = `
    @page {
      size: 80mm 297mm;
      margin: 0;
    }
  `;

  document.head.appendChild(style);

  return () => {
    style.remove();
  };
};
