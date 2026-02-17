'use client';

type FeedbackVariant = 'error' | 'success' | 'info';

interface FeedbackModalProps {
  open: boolean;
  variant?: FeedbackVariant;
  title?: string;
  message: string;
  onClose: () => void;
}

const themeByVariant: Record<FeedbackVariant, { box: string; title: string; button: string }> = {
  error: {
    box: 'border-red-200 bg-red-50',
    title: 'text-red-800',
    button: 'border-red-200 bg-white text-red-700 hover:bg-red-100',
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50',
    title: 'text-emerald-800',
    button: 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100',
  },
  info: {
    box: 'border-blue-200 bg-blue-50',
    title: 'text-blue-800',
    button: 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100',
  },
};

export default function FeedbackModal({
  open,
  variant = 'info',
  title,
  message,
  onClose,
}: FeedbackModalProps) {
  if (!open) return null;

  const labels = {
    error: 'Atenção',
    success: 'Sucesso',
    info: 'Informação',
  } as const;

  const theme = themeByVariant[variant];

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${theme.box}`}>
        <h3 className={`text-lg font-extrabold ${theme.title}`}>{title || labels[variant]}</h3>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${theme.button}`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

