import { Info, Settings, X } from 'lucide-react';

interface SettleUpInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Info modal that appears on first visit to Settle Up page
 * Explains the simplify debts feature and provides helpful tips
 */
export function SettleUpInfoModal({ isOpen, onClose }: SettleUpInfoModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Info className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Settle Up Tips</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-4 text-sm text-gray-600">
                    <p>
                        Welcome to the Settle Up page! Here you can view and manage all debts between trip members.
                    </p>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <Settings className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-blue-900 mb-1">Simplify Debts Feature</p>
                                <p className="text-blue-700 text-xs">
                                    You can toggle <strong>"Simplify debts"</strong> in Trip Settings to minimize the number of transactions needed to settle up. When enabled, the system calculates the most efficient way to balance all debts.
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-gray-500">
                        💡 Tip: Click on any debt to create a settlement or convert currencies.
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
}
