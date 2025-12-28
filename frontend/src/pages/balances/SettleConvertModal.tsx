import { ChevronDown, X } from 'lucide-react';
import React from 'react';
import { SUPPORTED_CURRENCIES } from '../../config/currencies';
import type { TripMember } from '../../types';
import type { ConvertDraftState, SettlementDraftState } from './types';

interface SettleConvertModalProps {
  settlementDraft: SettlementDraftState;
  convertDraft: ConvertDraftState;
  modalView: 'settle' | 'convert';
  setModalView: (view: 'settle' | 'convert') => void;
  setSettlementDraft: React.Dispatch<React.SetStateAction<SettlementDraftState>>;
  setConvertDraft: React.Dispatch<React.SetStateAction<ConvertDraftState>>;
  onClose: () => void;
  onSubmitSettlement: () => void;
  onSubmitConvert: () => void;
  onConvertCurrencyChange: (currency: string) => void;
  ratesLoading: boolean;
  convertedAmount: number;
  members: TripMember[];
  membersById: Map<number, TripMember>;
  createPending: boolean;
  convertPending: boolean;
  allowConvertTab: boolean;
  lockParticipants: boolean;
  lockConvertAmount: boolean;
}

export const SettleConvertModal: React.FC<SettleConvertModalProps> = ({
  settlementDraft,
  convertDraft,
  modalView,
  setModalView,
  setSettlementDraft,
  setConvertDraft,
  onClose,
  onSubmitSettlement,
  onSubmitConvert,
  onConvertCurrencyChange,
  ratesLoading,
  convertedAmount,
  members,
  membersById,
  createPending,
  convertPending,
  allowConvertTab,
  lockParticipants,
  lockConvertAmount,
}) => {
  if (!settlementDraft) return null;

  const showTabs = allowConvertTab;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-400 tracking-wide">Settle or Convert</div>
            <h3 className="text-lg font-semibold text-gray-900 mt-1">
              {settlementDraft.from_nickname || 'From'} → {settlementDraft.to_nickname || 'To'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {showTabs && (
          <div className="px-4 pt-3 flex gap-2">
            <button
              onClick={() => setModalView('settle')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${modalView === 'settle'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Settle Up
            </button>
            <button
              onClick={() => setModalView('convert')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${modalView === 'convert'
                ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
            >
              Convert
            </button>
          </div>
        )}

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-100 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-primary-700 font-semibold">Pair</div>
                <div className="text-sm font-semibold text-primary-900">
                  {settlementDraft.from_nickname || 'From'} → {settlementDraft.to_nickname || 'To'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-primary-700 font-semibold">Amount</div>
                <div className="text-xl font-bold text-primary-900">
                  {settlementDraft.amount || '0.00'} {settlementDraft.currency}
                </div>
              </div>
            </div>
            <div className="text-xs text-primary-700 mt-2">
              {modalView === 'settle' || !showTabs
                ? 'Create a settlement expense for this payment.'
                : 'Convert the debt to another currency using live rates.'}
            </div>
          </div>

          {modalView === 'settle' || !showTabs ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <div className="relative">
                    <select
                      value={settlementDraft.from_member_id}
                      disabled={lockParticipants}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const m = membersById.get(id);
                        setSettlementDraft(prev => prev ? { ...prev, from_member_id: id, from_nickname: m?.nickname } : prev);
                      }}
                      className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 appearance-none bg-white"
                    >
                      {(members || []).map((m: TripMember) => (
                        <option key={m.id} value={m.id}>{m.nickname}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <div className="relative">
                    <select
                      value={settlementDraft.to_member_id}
                      disabled={lockParticipants}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const m = membersById.get(id);
                        setSettlementDraft(prev => prev ? { ...prev, to_member_id: id, to_nickname: m?.nickname } : prev);
                      }}
                      className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500 appearance-none bg-white"
                    >
                      {(members || []).map((m: TripMember) => (
                        <option key={m.id} value={m.id}>{m.nickname}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settlementDraft.amount}
                    onChange={(e) => setSettlementDraft(prev => prev ? { ...prev, amount: e.target.value } : prev)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <div className="relative">
                    <select
                      value={settlementDraft.currency}
                      onChange={(e) => setSettlementDraft(prev => prev ? { ...prev, currency: e.target.value } : prev)}
                      className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg appearance-none bg-white"
                    >
                      {SUPPORTED_CURRENCIES.map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.code} ({curr.symbol})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={settlementDraft.notes}
                  onChange={(e) => setSettlementDraft(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          ) : (
            convertDraft && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-semibold text-gray-900">
                      {convertDraft.from_nickname || 'From'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-semibold text-gray-900 text-right">
                      {convertDraft.to_nickname || 'To'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({convertDraft.from_currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={convertDraft.amount}
                      disabled={lockConvertAmount}
                      onChange={(e) => setConvertDraft(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : prev)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Convert to</label>
                    <div className="relative">
                      <select
                        value={convertDraft.to_currency}
                        onChange={(e) => onConvertCurrencyChange(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg appearance-none bg-white"
                      >
                        {SUPPORTED_CURRENCIES.map((curr) => (
                          <option key={curr.code} value={curr.code}>
                            {curr.code} ({curr.symbol})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conversion rate (1 {convertDraft.from_currency} = ? {convertDraft.to_currency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      value={convertDraft.conversion_rate}
                      onChange={(e) => setConvertDraft(prev => prev ? { ...prev, conversion_rate: e.target.value } : prev)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-16"
                    />
                    {ratesLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Prefilled from current exchange rates. Adjust if you agreed on a custom rate.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Original:</span>
                    <span className="font-semibold text-gray-900">
                      {convertDraft.amount ? convertDraft.amount.toFixed(2) : '0.00'} {convertDraft.from_currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-green-300">
                    <span className="text-gray-700">Converted:</span>
                    <span className="font-bold text-green-700">
                      {convertedAmount ? convertedAmount.toFixed(2) : '0.00'} {convertDraft.to_currency}
                    </span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg"
          >
            Close
          </button>
          {modalView === 'settle' || !showTabs ? (
            <button
              onClick={onSubmitSettlement}
              disabled={createPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 shadow-sm"
            >
              {createPending ? 'Saving...' : 'Create'}
            </button>
          ) : (
            <button
              onClick={onSubmitConvert}
              disabled={convertPending || !convertDraft}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 shadow-sm"
            >
              {convertPending ? 'Converting...' : `Convert to ${convertDraft?.to_currency || ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

