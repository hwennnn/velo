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
                <div className="text-xs text-gray-500">Total (base)</div>
                <div className="text-lg font-bold text-red-600">
                  {group.total_base ? group.total_base.toFixed(2) : '—'} {baseCurrency}
                </div>
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

