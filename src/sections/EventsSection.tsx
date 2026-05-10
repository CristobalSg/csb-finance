import { type CSSProperties, useMemo, useState } from "react";

import { PrintIcon, XIcon } from "../components/icons";
import { shellCardClass } from "../constants/app";
import { orderMenuItems, type OrderMenuItem } from "../data/order-menu";
import { printTicket } from "../lib/thermal-printer";
import { buildEventTicketData, type ReceiptPaperSize } from "../lib/thermal-ticket";

type EventForm = {
  studentName: string;
  removedIngredients: string[];
  message: string;
};

const defaultEventMessage = "Feliz Día del Estudiante {nombre}, 8° E, Instituto Claret";

const emptyForm: EventForm = {
  studentName: "",
  removedIngredients: [],
  message: defaultEventMessage,
};

const getEventMessage = (message: string, name: string) => message.replaceAll("{nombre}", name.trim() || "{nombre}");

export function EventsSection() {
  const burgerItems = useMemo(() => orderMenuItems.filter((item) => item.category === "burgers"), []);
  const [selectedBurger, setSelectedBurger] = useState<OrderMenuItem | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [isPrinting, setIsPrinting] = useState(false);
  const receiptPreviewStyle = { "--receipt-width": paperSize } as CSSProperties;

  const closeModal = () => {
    if (isPrinting) {
      return;
    }

    setSelectedBurger(null);
    setForm(emptyForm);
    setPaperSize("80mm");
  };

  const openBurger = (burger: OrderMenuItem) => {
    setSelectedBurger(burger);
    setForm(emptyForm);
    setPaperSize("80mm");
  };

  const toggleIngredient = (ingredient: string) => {
    setForm((current) => ({
      ...current,
      removedIngredients: current.removedIngredients.includes(ingredient)
        ? current.removedIngredients.filter((currentIngredient) => currentIngredient !== ingredient)
        : [...current.removedIngredients, ingredient],
    }));
  };

  const handlePrint = async () => {
    if (!selectedBurger || isPrinting) {
      return;
    }

    const studentName = form.studentName.trim();

    if (!studentName) {
      window.alert("Ingresa el nombre antes de imprimir.");
      return;
    }

    setIsPrinting(true);

    try {
      await printTicket(
        buildEventTicketData({
          paperSize,
          studentName,
          burgerName: selectedBurger.name,
          removedIngredients: form.removedIngredients,
          message: getEventMessage(form.message, studentName),
        }),
      );

      setIsPrinting(false);
      closeModal();
    } catch (error) {
      setIsPrinting(false);
      window.alert(error instanceof Error ? error.message : "No fue posible imprimir la boleta del evento.");
    }
  };

  return (
    <section className="flex min-h-full flex-col gap-4">
      <section className={`${shellCardClass} min-h-[26rem]`}>
        <div className="flex flex-col gap-3 border-b border-rose-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-rose-500">Eventos</p>
            <h3 className="mt-1 text-xl font-bold text-rose-950">Impresion rapida</h3>
          </div>
          <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
            Solo hamburguesas
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {burgerItems.map((burger) => (
            <button
              key={burger.name}
              type="button"
              onClick={() => openBurger(burger)}
              className="flex min-h-28 flex-col justify-between rounded-[1.35rem] border border-rose-100 bg-rose-50/60 p-4 text-left transition hover:border-fuchsia-200 hover:bg-white"
            >
              <span className="text-base font-black leading-5 text-rose-950">{burger.name}</span>
              <span className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-700">
                Seleccionar
              </span>
            </button>
          ))}
        </div>
      </section>

      {selectedBurger ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-rose-500">Impresion rapida</p>
                <h3 className="text-xl font-bold text-rose-950">{selectedBurger.name}</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                aria-label="Cerrar impresion rapida"
              >
                <XIcon />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[calc(80mm+2rem)_minmax(0,1fr)]">
              <div className="min-h-0 overflow-auto rounded-[1.5rem] bg-stone-100 p-4">
                <div data-receipt-preview className="space-y-4" style={receiptPreviewStyle}>
                  <div className="receipt-paper mx-auto lg:mx-0">
                    <div className="text-center">
                      <img src="/receipt-logo.png" alt="Ceese Burger's" className="receipt-logo" />
                      <p className="mt-1 text-xs font-bold">Ceeseburger's Labranza</p>
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />

                    <div className="receipt-cut space-y-1 text-xs font-semibold">
                      {form.studentName.trim() ? <p>Nombre: {form.studentName.trim()}</p> : <p>Nombre: pendiente</p>}
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />

                    <div className="receipt-cut">
                      <p className="text-sm font-black">1 x {selectedBurger.name}</p>
                      <div className="mt-1 space-y-0.5 text-xs font-semibold">
                        {form.removedIngredients.length > 0 ? (
                          <p>Sin: {form.removedIngredients.join(", ")}</p>
                        ) : (
                          <p>Sin cambios de ingredientes</p>
                        )}
                      </div>
                    </div>

                    <div className="my-3 border-t border-dashed border-black" />
                    <p className="text-center text-sm font-black leading-5">
                      {getEventMessage(form.message, form.studentName)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white p-4">
                <div className="min-h-0 flex-1 space-y-5 overflow-auto pr-1">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Nombre</span>
                    <input
                      value={form.studentName}
                      onChange={(event) => setForm((current) => ({ ...current, studentName: event.target.value }))}
                      className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm text-rose-900 outline-none focus:border-fuchsia-400"
                      placeholder="Nombre del estudiante"
                    />
                  </label>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Ingredientes a sacar</p>
                    {selectedBurger.removableIngredients?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedBurger.removableIngredients.map((ingredient) => {
                          const isRemoved = form.removedIngredients.includes(ingredient);

                          return (
                            <button
                              key={ingredient}
                              type="button"
                              onClick={() => toggleIngredient(ingredient)}
                              className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                                isRemoved ? "border-red-200 bg-red-50 text-red-700" : "border-rose-200 bg-white text-rose-600"
                              }`}
                            >
                              {ingredient}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-[1rem] bg-rose-50/60 px-4 py-3 text-sm text-rose-700">
                        Esta hamburguesa no tiene ingredientes configurados para sacar.
                      </p>
                    )}
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Mensaje</span>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                      className="w-full rounded-[1rem] border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm font-bold leading-6 text-rose-900 outline-none focus:border-fuchsia-400"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-3 border-t border-rose-100 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isPrinting}
                    className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Papel</p>
                    <div className="grid grid-cols-2 gap-2 rounded-full bg-rose-50 p-1">
                      {(["80mm", "56mm"] as ReceiptPaperSize[]).map((currentPaperSize) => (
                        <button
                          key={currentPaperSize}
                          type="button"
                          onClick={() => setPaperSize(currentPaperSize)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                            paperSize === currentPaperSize ? "bg-fuchsia-600 text-white" : "text-rose-700"
                          }`}
                        >
                          {currentPaperSize}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-300/50 transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PrintIcon />
                    {isPrinting ? "Imprimiendo..." : "Imprimir"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
