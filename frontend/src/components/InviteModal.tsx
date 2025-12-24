/**
 * Invite Modal Component
 * Displays invite link for the trip
 */
import { Copy, Link2, X } from 'lucide-react';
import React from 'react';

interface InviteModalProps {
  isOpen: boolean;
  inviteLink: string | null;
  onClose: () => void;
  onCopy: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  inviteLink,
  onClose,
  onCopy,
}) => {
  if (!isOpen) return null;

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
            <input
              type="text"
              value={inviteLink || ''}
              readOnly
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700"
            />
            <button
              onClick={onCopy}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>

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

