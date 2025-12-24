/**
 * AlertModal Component
 * A reusable modal component to replace native browser alerts
 */
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertModalProps {
  isOpen: boolean;
  type?: AlertType;
  title?: string;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDuration?: number;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  type = 'info',
  title,
  message,
  onClose,
  autoClose = false,
  autoCloseDuration = 3000,
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDuration, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-amber-600" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-100',
          border: 'border-green-200',
          text: 'text-green-900',
        };
      case 'error':
        return {
          bg: 'bg-red-100',
          border: 'border-red-200',
          text: 'text-red-900',
        };
      case 'warning':
        return {
          bg: 'bg-amber-100',
          border: 'border-amber-200',
          text: 'text-amber-900',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-200',
          text: 'text-blue-900',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl animate-slideUp">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {title}
                </h3>
              )}
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

