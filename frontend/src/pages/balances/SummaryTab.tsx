import { ArrowRight, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import React, { useMemo } from 'react';
import { Avatar } from '../../components/Avatar';
import type { Debt } from '../../types';
import type { SummaryTabProps } from './types';

export const SummaryTab: React.FC<SummaryTabProps> = ({
  balances,
  baseCurrency,
  membersById,
  expandedMembers,
  onToggleMember,
  debts,
}) => {
  // Group debts by member (as debtor or creditor)
  const debtsByMember = useMemo(() => {
    const result: Record<number, { owes: Debt[]; owed: Debt[] }> = {};

    for (const debt of debts) {
      // Debts where this member owes someone
      if (!result[debt.from_member_id]) {
        result[debt.from_member_id] = { owes: [], owed: [] };
      }
      result[debt.from_member_id].owes.push(debt);

      // Debts where someone owes this member
      if (!result[debt.to_member_id]) {
        result[debt.to_member_id] = { owes: [], owed: [] };
      }
      result[debt.to_member_id].owed.push(debt);
    }

    return result;
  }, [debts]);

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
        const memberDebts = debtsByMember[balance.member_id];
        const hasDebtDetails = memberDebts && (memberDebts.owes.length > 0 || memberDebts.owed.length > 0);

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
                      <span className="flex flex-col">
                        <span>You owe:</span>
                        <span>{owedTo.toFixed(2)} {baseCurrency}</span>
                      </span>
                      <span className="flex flex-col">
                        <span>Owed to you:</span>
                        <span>{owed.toFixed(2)} {baseCurrency}</span>
                      </span>
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

              {/* Inline mini debt summary */}
              {hasDebtDetails && !isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {memberDebts.owes.slice(0, 2).map((debt, idx) => (
                      <span key={`owe-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full">
                        <ArrowRight className="w-3 h-3" />
                        {debt.to_nickname}: {debt.amount.toFixed(2)} {debt.currency}
                      </span>
                    ))}
                    {memberDebts.owed.slice(0, 2).map((debt, idx) => (
                      <span key={`owed-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full">
                        <ArrowRight className="w-3 h-3 rotate-180" />
                        {debt.from_nickname}: {debt.amount.toFixed(2)} {debt.currency}
                      </span>
                    ))}
                    {(memberDebts.owes.length > 2 || memberDebts.owed.length > 2) && (
                      <span className="text-gray-400">+more</span>
                    )}
                  </div>
                </div>
              )}

              {(hasCurrencyBreakdown || hasDebtDetails) && (
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
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </span>
                </button>
              )}
            </div>

            {(hasCurrencyBreakdown || hasDebtDetails) && isExpanded && (
              <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                {/* Currency breakdown */}
                {hasCurrencyBreakdown && (
                  <div>
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

                {/* Detailed debt breakdown */}
                {hasDebtDetails && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Debt Details</h5>
                    <div className="space-y-3">
                      {/* Who they owe */}
                      {memberDebts.owes.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Owes</div>
                          <div className="space-y-2">
                            {memberDebts.owes.map((debt, idx) => (
                              <div key={`owe-${idx}`} className="flex items-center justify-between bg-white rounded-lg p-2 border border-red-100">
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    size="xs"
                                    className="w-6 h-6"
                                    member={membersById.get(debt.to_member_id) || {
                                      id: debt.to_member_id,
                                      nickname: debt.to_nickname,
                                    }}
                                  />
                                  <span className="text-sm text-gray-700">{debt.to_nickname}</span>
                                </div>
                                <span className="text-sm font-semibold text-red-600">
                                  {debt.amount.toFixed(2)} {debt.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Who owes them */}
                      {memberDebts.owed.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Owed by</div>
                          <div className="space-y-2">
                            {memberDebts.owed.map((debt, idx) => (
                              <div key={`owed-${idx}`} className="flex items-center justify-between bg-white rounded-lg p-2 border border-green-100">
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    size="xs"
                                    className="w-6 h-6"
                                    member={membersById.get(debt.from_member_id) || {
                                      id: debt.from_member_id,
                                      nickname: debt.from_nickname,
                                    }}
                                  />
                                  <span className="text-sm text-gray-700">{debt.from_nickname}</span>
                                </div>
                                <span className="text-sm font-semibold text-green-600">
                                  {debt.amount.toFixed(2)} {debt.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
