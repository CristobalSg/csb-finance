import type { ToastState } from "../../constants/app";

export function ToastBanner({ toast }: { toast: ToastState | null }) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`mb-6 rounded-[1.5rem] border px-4 py-3 text-sm font-medium ${
        toast.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {toast.message}
    </div>
  );
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return <div className="mb-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
}
