export type ReceiptLogoOption = {
  id: string;
  label: string;
  detail: string;
  path: string;
};

export const receiptLogoPreferenceKey = "csb-receipt-logo-path";

export const receiptLogoOptions: ReceiptLogoOption[] = [
  {
    id: "thermal",
    label: "Logo boleta",
    detail: "Version optimizada para impresora",
    path: "receipt-logo-thermal.png",
  },
  {
    id: "classic",
    label: "Logo clasico",
    detail: "Logo usado en la vista previa",
    path: "receipt-logo.png",
  },
  {
    id: "horizontal",
    label: "Logo horizontal",
    detail: "Ocupa menos alto en la boleta",
    path: "Logo_ceese_horizontal_png.png",
  },
  {
    id: "burguito",
    label: "Ceeseburguito",
    detail: "Imagen del personaje",
    path: "ceeseburgito.jpeg",
  },
];

export const defaultReceiptLogoPath = receiptLogoOptions[0].path;

export const getValidReceiptLogoPath = (value: string | null | undefined): string => {
  if (receiptLogoOptions.some((option) => option.path === value)) {
    return value as string;
  }

  return defaultReceiptLogoPath;
};
