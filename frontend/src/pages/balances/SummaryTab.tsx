import { ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import React from 'react';
import { Avatar } from '../../components/Avatar';
import type { SummaryTabProps } from './types';

export const SummaryTab: React.FC<SummaryTabProps> = ({
  balances,
  baseCurrency,
  membersById,
  expandedMembers,
  onToggleMember,
}) => {
  if ((balances || []).length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No balance data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {balances.map((balance) => {
        const member = membersById.get(balance.member_id);
        const isExpanded = expandedMembers.has(balance.member_id);
        const hasCurrencyBreakdown = balance.currency_balances && Object.keys(balance.currency_balances).length > 0;

        const net = parseFloat(balance.net_balance.toString());
        const owed = parseFloat(balance.total_owed.toString());
        const owedTo = parseFloat(balance.total_owed_to.toString());

        return (
          <div key={balance.member_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar
                    size="md"
                    className="w-12 h-12"
                    member={{
                      id: balance.member_id,
                      nickname: member?.nickname ?? balance.member_nickname,
                      display_name: member?.display_name,
                      avatar_url: member?.avatar_url,
                    }}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{balance.member_nickname}</h4>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>You owe: {owedTo.toFixed(2)} {baseCurrency}</span>
                      <span>Owed to you: {owed.toFixed(2)} {baseCurrency}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xl font-bold ${net > 0.01 ? 'text-green-600' : net < -0.01 ? 'text-red-600' : 'text-gray-500'
                      }`}
                  >
                    {net > 0.01 ? '+' : ''}{net.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{baseCurrency}</div>
                </div>
              </div>

              {hasCurrencyBreakdown && (
                <button
                  onClick={() => onToggleMember(balance.member_id)}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
                >
                  <span className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-primary-700" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-primary-700" />
                    )}
                    {isExpanded ? 'Hide currency breakdown' : 'Show currency breakdown'}
                  </span>
                </button>
              )}
            </div>

            {hasCurrencyBreakdown && isExpanded && (
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                <h5 className="text-sm font-medium text-gray-700 mb-3">Balance by Currency</h5>
                <div className="space-y-2">
                  {Object.entries(balance.currency_balances).map(([curr, amount]) => {
                    const a = parseFloat(amount.toString());
                    return (
                      <div key={curr} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">{curr}</span>
                        <span className={`font-semibold ${a > 0.01 ? 'text-green-600' : a < -0.01 ? 'text-red-600' : 'text-gray-500'}`}>
                          {a > 0.01 ? '+' : ''}{a.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

