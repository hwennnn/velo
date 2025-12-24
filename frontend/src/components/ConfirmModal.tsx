/**
 * ConfirmModal Component
 * A reusable confirmation modal to replace native browser confirm dialogs
 */
import { AlertCircle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-primary-600 hover:bg-primary-700',
  onConfirm,
  onCancel,
}) => {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl animate-slideUp">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {title}
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {message}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2.5 text-white rounded-xl font-medium transition-colors ${confirmButtonClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

