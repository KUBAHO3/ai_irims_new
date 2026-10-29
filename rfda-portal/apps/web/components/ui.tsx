'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------------- Toasts */
const ToastCtx = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

/* ---------------------------------------------------------------- Modals */
type Render = (close: () => void) => ReactNode;
const ModalCtx = createContext<(render: Render) => void>(() => undefined);
/** Opens a modal. The render function receives `close`; use <ModalFrame> as its root. */
export const useModal = () => useContext(ModalCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [modals, setModals] = useState<{ id: number; render: Render }[]>([]);
  const seq = useRef(0);

  const toast = useCallback((msg: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-1), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const open = useCallback((render: Render) => { const id = ++seq.current; setModals((m) => [...m, { id, render }]); }, []);

  useEffect(() => { document.body.classList.toggle('modal-open', modals.length > 0); }, [modals.length]);

  return (
    <ToastCtx.Provider value={toast}>
      <ModalCtx.Provider value={open}>
        {children}
        {modals.map((m) => <ModalHost key={m.id} render={m.render} onClose={() => setModals((all) => all.filter((x) => x.id !== m.id))} />)}
        <div className="toast-wrap" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
      </ModalCtx.Provider>
    </ToastCtx.Provider>
  );
}

const FrameCtx = createContext<() => void>(() => undefined);

function ModalHost({ render, onClose }: { render: Render; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, footer .btn.primary, [data-close]');
    first?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-back" ref={ref} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <FrameCtx.Provider value={onClose}>{render(onClose)}</FrameCtx.Provider>
    </div>
  );
}

export function ModalFrame({ title, wide, children, footer }: { title: ReactNode; wide?: boolean; children: ReactNode; footer?: ReactNode }) {
  const close = useContext(FrameCtx);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" style={wide ? { width: 'min(860px,100%)' } : undefined}>
      <header><h2 id="mtitle" style={{ fontSize: 18 }}>{title}</h2><span className="spacer" /><button className="btn small" data-close aria-label="Close" onClick={close}>Close</button></header>
      <div className="body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}

/** Small async-button helper: disables while running and reports errors as a toast. */
export function useBusy() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }, [busy, toast]);
  return { busy, run };
}
