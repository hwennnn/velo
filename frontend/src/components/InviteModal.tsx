/**
 * Invite Modal Component
 * Displays invite link for the trip
 */
import { Copy, Link2, X } from 'lucide-react';
import React from 'react';

interface InviteModalProps {
  isOpen: boolean;
  inviteLink: string | null;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onCopy: () => void;
  onRetry?: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  inviteLink,
  isLoading = false,
  error = null,
  onClose,
  onCopy,
  onRetry,
}) => {
  if (!isOpen) return null;

  const isReady = !!inviteLink && !isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Invite Link</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Share this link with others to invite them to this trip:
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inviteLink || ''}
                readOnly
                disabled={!isReady}
                placeholder={isLoading ? 'Generating invite link…' : ''}
                className={`w-full px-4 py-2.5 bg-gray-50 border rounded-lg text-sm ${
                  isReady ? 'text-gray-700 border-gray-300' : 'text-gray-400 border-gray-200'
                } pr-10`}
              />
              {isLoading && (
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-primary-600 animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (!isReady) return;
                onCopy();
              }}
              disabled={!isReady}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isReady
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-gray-500/40 border-t-gray-600 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          {!!error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
              <p className="text-xs text-red-800">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="shrink-0 text-xs font-semibold text-red-700 hover:text-red-800 underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900">
              💡 Anyone with this link can join the trip. The link contains the trip ID.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};



