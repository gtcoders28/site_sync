import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const config = {
    success: {
      bg: 'bg-white text-slate-800 border-emerald-500/30 shadow-emerald-500/10',
      iconContainer: 'bg-emerald-500/10 text-emerald-600',
      icon: <CheckCircle2 size={17} className="text-emerald-600" />,
      accentBar: 'bg-emerald-500',
    },
    error: {
      bg: 'bg-white text-slate-800 border-rose-500/30 shadow-rose-500/10',
      iconContainer: 'bg-rose-500/10 text-rose-600',
      icon: <AlertCircle size={17} className="text-rose-600" />,
      accentBar: 'bg-rose-500',
    },
    info: {
      bg: 'bg-white text-slate-800 border-blue-500/30 shadow-blue-500/10',
      iconContainer: 'bg-blue-500/10 text-blue-600',
      icon: <Info size={17} className="text-blue-600" />,
      accentBar: 'bg-blue-500',
    },
  }[toast?.type || 'info'];

  return (
    <AnimatePresence>
      {toast && (
        <div className="fixed bottom-5 inset-x-4 sm:inset-x-auto sm:right-6 z-50 flex justify-center sm:justify-end pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 350 }}
            className={`pointer-events-auto flex items-center gap-3.5 pl-3.5 pr-2.5 py-3 rounded-2xl border shadow-xl backdrop-blur-xl ${config.bg} max-w-md w-full relative overflow-hidden`}
            role="alert"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${config.iconContainer}`}>
              {config.icon}
            </div>
            <p className="text-xs sm:text-sm font-semibold flex-1 pr-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700 cursor-pointer active:scale-95"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
            <div className={`absolute bottom-0 inset-x-0 h-0.5 ${config.accentBar}`} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
