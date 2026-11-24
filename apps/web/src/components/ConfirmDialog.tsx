import { useEffect, useState } from 'react';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirm: string;
  /** Red confirm button for irreversible actions. */
  danger?: boolean;
  run: () => Promise<unknown>;
}

/** Modal confirmation for final or destructive actions. Escape or backdrop cancels. */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onClose]);
  if (!request) return null;
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await request.run();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex animate-[cm-fade_.15s] items-center justify-center bg-[rgba(15,23,42,.45)] p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
        className="box-border w-full max-w-[440px] animate-[cm-dialog_.2s_ease-out] rounded-[18px] bg-white p-6 shadow-[0_30px_70px_rgba(15,23,42,.2)]"
      >
        <h2 id="confirm-title" className="m-0 text-[20px] font-extrabold tracking-[-0.02em]">
          {request.title}
        </h2>
        <p id="confirm-body" className="mt-2 mb-0 text-[14px] leading-[1.55] text-slate-600">
          {request.body}
        </p>
        {error && (
          <p role="alert" className="mt-3 mb-0 text-[13px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-[42px] cursor-pointer rounded-[10px] border-0 bg-slate-100 px-4 text-[14px] font-bold text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            autoFocus
            className={'h-[42px] cursor-pointer rounded-[10px] border-0 px-[18px] text-[14px] font-bold text-white disabled:opacity-60 ' + (request.danger ? 'bg-danger-strong' : 'bg-brand')}
          >
            {busy ? 'Working…' : request.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
