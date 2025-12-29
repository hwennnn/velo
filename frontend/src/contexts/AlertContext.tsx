/**
 * AlertContext
 * Global context for managing alerts throughout the application
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import type { AlertType } from '../components/AlertModal';
import { AlertModal } from '../components/AlertModal';
import { ConfirmModal } from '../components/ConfirmModal';

interface AlertOptions {
  type?: AlertType;
  title?: string;
  autoClose?: boolean;
  autoCloseDuration?: number;
}

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

interface AlertContextType {
  showAlert: (message: string, options?: AlertOptions) => void;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Alert state
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertOptions, setAlertOptions] = useState<AlertOptions>({});

  // Confirm state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions>({});
  const [confirmResolver, setConfirmResolver] = useState<((value: boolean) => void) | null>(null);

  const showAlert = useCallback((msg: string, opts: AlertOptions = {}) => {
    setAlertMessage(msg);
    setAlertOptions(opts);
    setIsAlertOpen(true);
  }, []);

  const showConfirm = useCallback((msg: string, opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfirmMessage(msg);
      setConfirmOptions(opts);
      setConfirmResolver(() => resolve);
      setIsConfirmOpen(true);
    });
  }, []);

  const handleAlertClose = useCallback(() => {
    setIsAlertOpen(false);
  }, []);

  const handleConfirmClose = useCallback((confirmed: boolean) => {
    setIsConfirmOpen(false);
    if (confirmResolver) {
      confirmResolver(confirmed);
      setConfirmResolver(null);
    }
  }, [confirmResolver]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        isOpen={isAlertOpen}
        message={alertMessage}
        type={alertOptions.type}
        title={alertOptions.title}
        autoClose={alertOptions.autoClose}
        autoCloseDuration={alertOptions.autoCloseDuration}
        onClose={handleAlertClose}
      />
      <ConfirmModal
        isOpen={isConfirmOpen}
        message={confirmMessage}
        title={confirmOptions.title}
        confirmText={confirmOptions.confirmText}
        cancelText={confirmOptions.cancelText}
        confirmButtonClass={confirmOptions.confirmButtonClass}
        onConfirm={() => handleConfirmClose(true)}
        onCancel={() => handleConfirmClose(false)}
      />
    </AlertContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAlert = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

