import { ArrowRight } from 'lucide-react';
import React from 'react';
import { Avatar } from '../../components/Avatar';
import type { DebtsTabProps } from './types';

export const DebtsTab: React.FC<DebtsTabProps> = ({
  groupedDebts,
  baseCurrency,
  membersById,
  onSettle,
}) => {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-semibold">
            ↔
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Tap a row to settle up</div>
            <div className="text-xs text-gray-500">Net debts are grouped by payer → receiver.</div>
          </div>
        </div>
      </div>

      {groupedDebts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">All settled up! No outstanding debts.</p>
        </div>
      ) : (
        groupedDebts.map((group, idx) => (
          <div
            key={`${group.from_id}-${group.to_id}-${idx}`}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Avatar
                  size="sm"
                  className="w-10 h-10"
                  member={{
                    id: group.from_id,
                    nickname: group.from_name,
                    avatar_url: membersById.get(group.from_id)?.avatar_url,
                    display_name: membersById.get(group.from_id)?.display_name,
                  }}
                />

                <ArrowRight className="w-4 h-4 text-gray-400" />

                <Avatar
                  size="sm"
                  className="w-10 h-10"
                  member={{
                    id: group.to_id,
                    nickname: group.to_name,
                    avatar_url: membersById.get(group.to_id)?.avatar_url,
                    display_name: membersById.get(group.to_id)?.display_name,
                  }}
                />
              </div>

              <div className="text-right">
                {
                  // Multi-currency case with tooltip
                  <div className="group relative">
                    <div className="text-xs text-gray-500">Total (approx)</div>
                    <div className="text-lg font-bold text-gray-700 underline decoration-dotted cursor-help">
                      {group.total_base ? group.total_base.toFixed(2) : '—'} {baseCurrency}
                    </div>

                    {/* Tooltip */}
                    <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl">
                      <div className="font-semibold mb-1 border-b border-gray-700 pb-1">Breakdown</div>
                      <div className="space-y-1">
                        {Object.entries(group.totals_by_currency).map(([curr, amt]) => (
                          <div key={curr} className="flex justify-between">
                            <span>{curr}</span>
                            <span className="font-mono">{amt}</span>
                          </div>
                        ))}
                      </div>
                      {/* Triangle pointer */}
                      <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {group.rows.map((debt) => (
                <div
                  key={`${debt.currency}-${debt.amount}`}
                  className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="font-medium text-gray-800">{group.from_name}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="font-medium text-gray-800">{group.to_name}</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {parseFloat(debt.amount.toString()).toFixed(2)} {debt.currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSettle(debt)}
                      className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
                    >
                      Settle Up
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

