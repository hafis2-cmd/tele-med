import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'danger' | 'warning' | 'info';
}

interface ConfirmationContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmOptions & { resolve: (value: boolean) => void } | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfig({
        ...options,
        resolve: (val) => {
          setIsOpen(false);
          resolve(val);
        }
      });
      setIsOpen(true);
    });
  };

  const handleCancel = () => {
    if (config) {
      config.resolve(false);
    }
  };

  const handleConfirm = () => {
    if (config) {
      config.resolve(true);
    }
  };

  const getSeverityStyles = (severity: 'danger' | 'warning' | 'info' = 'danger') => {
    switch (severity) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 dark:shadow-none'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200 dark:shadow-none'
        };
      case 'info':
        return {
          iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-none'
        };
    }
  };

  const { iconBg, confirmBtn } = getSeverityStyles(config?.severity);

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && config && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Overlapping Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCancel}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />

              {/* Central Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center space-y-6"
              >
                {/* Warning Icon Container */}
                <div className={`p-4 rounded-2xl ${iconBg} transition-colors`}>
                  <AlertTriangle className="w-8 h-8" />
                </div>

                {/* Question Details */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    {config.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {config.message}
                  </p>
                </div>

                {/* Dialog Action Buttons */}
                <div className="flex gap-4 w-full pt-2">
                  <button
                    onClick={handleCancel}
                    type="button"
                    className="flex-1 py-3.5 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer"
                  >
                    {config.cancelLabel || 'Keep'}
                  </button>
                  <button
                    onClick={handleConfirm}
                    type="button"
                    className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm transition-all cursor-pointer ${confirmBtn}`}
                  >
                    {config.confirmLabel || 'Confirm Delete'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (context === undefined) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}
