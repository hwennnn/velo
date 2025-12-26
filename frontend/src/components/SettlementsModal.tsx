/**
 * Settlements Modal Component
 * Modal showing settlement plan with multi-currency support and recording
 * Supports currency conversion for settlements and grouping by payer-payee pairs
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Layers, RefreshCw, User, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { SUPPORTED_CURRENCIES } from '../config/currencies';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { balanceKeys, useSettlements } from '../hooks/useBalances';
import { calculateCrossRate, useExchangeRates } from '../hooks/useExchangeRates';
import { expenseKeys } from '../hooks/useExpenses';
import { tripKeys } from '../hooks/useTrips';
import { api } from '../services/api';
import type { GroupedSettlement, Settlement, SettlementInput, TripMember } from '../types';
import { groupSettlementsByPair } from '../utils/settlements';
import { Avatar } from './Avatar';
import { Shimmer } from './Shimmer';

// Reusable component for individual settlement items
interface SettlementCardProps {
  settlement: Settlement;
  group: GroupedSettlement;
  recordingSettlements: Set<string>;
  currency: string;
  getMemberColor: (memberId: number) => string;
  membersById: Map<number, TripMember>;
  showPayerPayee?: boolean; // Show payer/payee info (for individual view)
  onRecordSettlement: (settlement: Settlement) => void;
  onShowMergeModal: (group: GroupedSettlement, settlement: Settlement) => void;
  showConfirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
}

const SettlementCard: React.FC<SettlementCardProps> = ({
  settlement,
  group,
  recordingSettlements,
  currency,
  getMemberColor,
  membersById,
  showPayerPayee = false,
  onRecordSettlement,
  onShowMergeModal,
  showConfirm,
}) => {
  const settlementKey = `${settlement.from_member_id}-${settlement.to_member_id}-${settlement.currency}`;
  const isRecording = recordingSettlements.has(settlementKey);
  const fromColor = getMemberColor(settlement.from_member_id);
  const toColor = getMemberColor(settlement.to_member_id);
  const fromMember = membersById.get(settlement.from_member_id);
  const toMember = membersById.get(settlement.to_member_id);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Payer/Payee Information - Only show in individual view */}
      {showPayerPayee && (
        <div className="flex items-center gap-3 mb-4">
          {/* From Member */}
          <div className="flex items-center gap-2 flex-1">
            <Avatar
              size="md"
              className="w-10 h-10"
              fallbackColorClass={fromColor}
              member={{
                id: settlement.from_member_id,
                nickname: fromMember?.nickname ?? settlement.from_nickname,
                display_name: fromMember?.display_name,
                avatar_url: fromMember?.avatar_url,
              }}
            />
            <span className="font-medium text-gray-900 text-sm">{settlement.from_nickname}</span>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center">
            <ArrowRight className="w-5 h-5 text-primary-600" />
          </div>

          {/* To Member */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-medium text-gray-900 text-sm">{settlement.to_nickname}</span>
            <Avatar
              size="md"
              className="w-10 h-10"
              fallbackColorClass={toColor}
              member={{
                id: settlement.to_member_id,
                nickname: toMember?.nickname ?? settlement.to_nickname,
                display_name: toMember?.display_name,
                avatar_url: toMember?.avatar_url,
              }}
            />
          </div>
        </div>
      )}

      {/* Amount and Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-gray-900">
            {Number(settlement.amount).toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">{settlement.currency}</div>
        </div>
        <button
          onClick={() => onShowMergeModal(group, settlement)}
          className={`text-xs font-medium flex items-center gap-1 transition-all ${
            settlement.currency !== currency
              ? 'text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-md shadow-sm'
              : 'text-blue-600 hover:text-blue-700 bg-gray-100 px-2 py-1 rounded-md shadow-sm'
          }`}
          title={
            settlement.currency !== currency
              ? `Convert ${settlement.currency} to ${currency} for easier payment`
              : 'Convert this debt to a different currency'
          }
        >
          <RefreshCw className="w-3 h-3" />
          <span>{ settlement.currency !== currency ? "Convert" : "Convert to different currency" }</span>
        </button>
      </div>
      <button
        onClick={async () => {
          const confirmed = await showConfirm(
            `Mark ${settlement.amount.toFixed(2)} ${settlement.currency} payment from ${settlement.from_nickname} to ${settlement.to_nickname} as paid?`,
            {
              title: 'Confirm Payment',
              confirmText: 'Mark as Paid',
              cancelText: 'Cancel'
            }
          );
          if (confirmed) {
            onRecordSettlement(settlement);
          }
        }}
        disabled={isRecording}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {isRecording ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Recording...</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>Mark as Paid</span>
          </>
        )}
      </button>
    </div>
  );
};


interface SettlementsModalProps {
  isOpen: boolean;
  tripId: string;
  currency: string;
  getMemberColor: (memberId: number) => string;
  members?: TripMember[];
  onClose: () => void;
}

export const SettlementsModal: React.FC<SettlementsModalProps> = ({
  isOpen,
  tripId,
  currency,
  getMemberColor,
  members = [],
  onClose,
}) => {
  // Fetch settlements only when modal is open
  const { data: settlements = [], isLoading } = useSettlements(isOpen ? tripId : undefined);
  
  // Fetch exchange rates for the base currency
  const { data: exchangeRatesData, isLoading: ratesLoading } = useExchangeRates(isOpen ? currency : undefined);
  
  const [recordingSettlements, setRecordingSettlements] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'individual' | 'grouped'>('grouped');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState<{
    group: GroupedSettlement;
    settlement: Settlement;
  } | null>(null);
  const [mergeToCurrency, setMergeToCurrency] = useState<string>('');
  const [customConversionRate, setCustomConversionRate] = useState<string>('');
  const [filterMyDebts, setFilterMyDebts] = useState(false);
  const queryClient = useQueryClient();
  const { showAlert, showConfirm } = useAlert();
  const { user } = useAuth();
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // Get exchange rates or use fallback (memoized to prevent re-renders)
  const exchangeRates = useMemo(() => {
    return exchangeRatesData?.rates || { [currency]: 1 };
  }, [exchangeRatesData?.rates, currency]);

  // Get current user's member ID
  const currentUserMemberId = useMemo(() => {
    return members.find(m => m.user_id === user?.id)?.id;
  }, [members, user?.id]);

  // Filter settlements based on current user's debts
  const filteredSettlements = useMemo(() => {
    if (!filterMyDebts || !currentUserMemberId) {
      return settlements;
    }
    return settlements.filter(s => s.from_member_id === currentUserMemberId);
  }, [settlements, filterMyDebts, currentUserMemberId]);

  // Group settlements by payer-payee pairs
  const groupedSettlements = useMemo(() => {
    return groupSettlementsByPair(filteredSettlements, exchangeRates);
  }, [filteredSettlements, exchangeRates]);

  // Mutation for recording settlements
  const recordSettlementMutation = useMutation({
    mutationFn: (settlementData: SettlementInput) => 
      api.balances.recordSettlement(tripId, settlementData),
    onSuccess: () => {
      // Invalidate expense queries (settlement creates a settlement-type expense)
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (query) => {
          // Match any expense query that includes this tripId
          return query.queryKey.includes(tripId);
        }
      });
      // Invalidate trip data (for totals and metadata)
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      // Invalidate balances and settlements (debts changed)
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.settlements(tripId) });
      showAlert('Settlement recorded successfully', { type: 'success' });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      showAlert(
        err.response?.data?.detail || 'Failed to record settlement',
        { type: 'error' }
      );
    },
  });

  const handleRecordSettlement = async (settlement: Settlement) => {
    const settlementKey = `${settlement.from_member_id}-${settlement.to_member_id}-${settlement.currency}`;
    
    if (recordingSettlements.has(settlementKey)) {
      return; // Already recording
    }

    setRecordingSettlements(prev => new Set(prev).add(settlementKey));

    try {
      const settlementData: SettlementInput = {
        from_member_id: settlement.from_member_id,
        to_member_id: settlement.to_member_id,
        amount: settlement.amount,
        currency: settlement.currency,
        settlement_date: new Date().toISOString().split('T')[0],
        notes: `Settlement: ${settlement.from_nickname} → ${settlement.to_nickname}`,
      };

      await recordSettlementMutation.mutateAsync(settlementData);
    } finally {
      setRecordingSettlements(prev => {
        const newSet = new Set(prev);
        newSet.delete(settlementKey);
        return newSet;
      });
    }
  };

  const handleShowMergeModal = (group: GroupedSettlement, settlement: Settlement) => {
    setShowMergeModal({ group, settlement });
    // Default to base currency for easier payment
    setMergeToCurrency(currency);
    // Calculate and set default conversion rate
    const defaultRate = calculateCrossRate(
      settlement.currency,
      currency,
      exchangeRates,
      currency
    );
    setCustomConversionRate(defaultRate.toString());
  };

  // Mutation for merging debt currencies
  const mergeDebtMutation = useMutation({
    mutationFn: (mergeData: {
      from_member_id: number;
      to_member_id: number;
      amount: number;
      from_currency: string;
      to_currency: string;
      conversion_rate: number;
    }) => 
      api.balances.mergeDebtCurrency(tripId, mergeData),
    onSuccess: () => {
      // Invalidate balances and settlements (debts changed)
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.settlements(tripId) });
      // Invalidate trip data (balances might affect trip totals)
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      showAlert('Debt currency merged successfully', { type: 'success' });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      showAlert(
        err.response?.data?.detail || 'Failed to merge debt currency',
        { type: 'error' }
      );
    },
  });

  const handleMergeSettlement = async () => {
    if (!showMergeModal || !customConversionRate) return;

    const confirmed = await showConfirm(
      `Convert ${showMergeModal.settlement.amount.toFixed(2)} ${showMergeModal.settlement.currency} debt from ${showMergeModal.settlement.from_nickname} to ${showMergeModal.settlement.to_nickname}?`,
      {
        title: 'Convert Currency',
        confirmText: 'Convert',
        cancelText: 'Cancel'
      }
    );
    
    if (!confirmed) {
      return;
    }

    const { settlement } = showMergeModal;
    
    // Use the custom conversion rate (user can edit it)
    const rate = parseFloat(customConversionRate);
    
    if (isNaN(rate) || rate <= 0) {
      showAlert('Please enter a valid conversion rate', { type: 'error' });
      return;
    }

    // Merge the debt currency (without paying)
    const mergeData = {
      from_member_id: settlement.from_member_id,
      to_member_id: settlement.to_member_id,
      amount: settlement.amount,
      from_currency: settlement.currency,
      to_currency: mergeToCurrency,
      conversion_rate: rate,
    };

    try {
      await mergeDebtMutation.mutateAsync(mergeData);
      setShowMergeModal(null);
      setMergeToCurrency('');
      setCustomConversionRate('');
    } catch {
      // Error handled by mutation
    }
  };

  const toggleGroupExpanded = (pairKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairKey)) {
        newSet.delete(pairKey);
      } else {
        newSet.add(pairKey);
      }
      return newSet;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Settlement Plan</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          </div>
          
          {/* View Mode Toggle */}
          {settlements.length > 0 && (
            <>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'grouped'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Grouped</span>
                </button>
                <button
                  onClick={() => setViewMode('individual')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'individual'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>Individual</span>
                </button>
              </div>
              
              {/* Filter Button */}
              {currentUserMemberId && (
                <button
                  onClick={() => setFilterMyDebts(!filterMyDebts)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterMyDebts
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{filterMyDebts ? 'Showing My Debts' : 'Show My Debts Only'}</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          // Loading skeleton with shimmer
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Shimmer className="h-4 rounded w-48" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Shimmer className="w-10 h-10 rounded-full" />
                    <Shimmer className="h-4 rounded w-20" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Shimmer className="w-5 h-5 rounded" />
                    <Shimmer className="h-5 rounded w-16" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <Shimmer className="h-4 rounded w-20" />
                    <Shimmer className="w-10 h-10 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-gray-900 mb-2">All Balanced!</h4>
            <p className="text-gray-600">All expenses are settled. No payments needed.</p>
          </div>
        ) : filteredSettlements.length === 0 && filterMyDebts ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-gray-900 mb-2">You're All Set!</h4>
            <p className="text-gray-600">You don't owe anyone. Great job staying on top of expenses!</p>
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped View */
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>{groupedSettlements.length}</strong> payment pair{groupedSettlements.length !== 1 ? 's' : ''}{' '}
                ({filteredSettlements.length} total transaction{filteredSettlements.length !== 1 ? 's' : ''})
                {filterMyDebts && currentUserMemberId && (
                  <span className="block mt-1 text-orange-700 font-medium">
                    Showing only payments you need to make
                  </span>
                )}
              </p>
            </div>

            {groupedSettlements.map((group) => {
              const pairKey = `${group.from_member_id}-${group.to_member_id}`;
              const isExpanded = expandedGroups.has(pairKey);
              const fromColor = getMemberColor(group.from_member_id);
              const toColor = getMemberColor(group.to_member_id);
              const hasMultipleCurrencies = group.settlements.length > 1;
              const fromMember = membersById.get(group.from_member_id);
              const toMember = membersById.get(group.to_member_id);

              return (
                <div
                  key={pairKey}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Group Header */}
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {/* From Member */}
                      <div className="flex items-center gap-2 flex-1">
                        <Avatar
                          size="md"
                          className="w-10 h-10"
                          fallbackColorClass={fromColor}
                          member={{
                            id: group.from_member_id,
                            nickname: fromMember?.nickname ?? group.from_nickname,
                            display_name: fromMember?.display_name,
                            avatar_url: fromMember?.avatar_url,
                          }}
                        />
                        <span className="font-medium text-gray-900 text-sm">{group.from_nickname}</span>
                      </div>

                      {/* Arrow and Summary */}
                      <div className="flex flex-col items-center gap-1">
                        <ArrowRight className="w-5 h-5 text-primary-600" />
                        <div className="text-center">
                          <div className="text-xs text-gray-500">
                            {group.settlements.length} {hasMultipleCurrencies ? 'currencies' : 'payment'}
                          </div>
                        </div>
                      </div>

                      {/* To Member */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="font-medium text-gray-900 text-sm">{group.to_nickname}</span>
                        <Avatar
                          size="md"
                          className="w-10 h-10"
                          fallbackColorClass={toColor}
                          member={{
                            id: group.to_member_id,
                            nickname: toMember?.nickname ?? group.to_nickname,
                            display_name: toMember?.display_name,
                            avatar_url: toMember?.avatar_url,
                          }}
                        />
                      </div>
                    </div>

                    {/* Expand/Collapse Button */}
                    {hasMultipleCurrencies && (
                      <button
                        onClick={() => toggleGroupExpanded(pairKey)}
                        className="w-full mt-3 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Hide details</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>Show {group.settlements.length} currencies</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {(isExpanded || !hasMultipleCurrencies) && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                      {group.settlements.map((settlement, idx) => (
                        <SettlementCard
                          key={idx}
                          settlement={settlement}
                          group={group}
                          recordingSettlements={recordingSettlements}
                          currency={currency}
                          getMemberColor={getMemberColor}
                          membersById={membersById}
                          showPayerPayee={false}
                          onRecordSettlement={handleRecordSettlement}
                          onShowMergeModal={handleShowMergeModal}
                          showConfirm={showConfirm}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Individual View */
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>{filteredSettlements.length}</strong> payment{filteredSettlements.length !== 1 ? 's' : ''}{' '}
                needed to settle all expenses
                {filterMyDebts && currentUserMemberId && (
                  <span className="block mt-1 text-orange-700 font-medium">
                    Showing only payments you need to make
                  </span>
                )}
              </p>
            </div>

            {filteredSettlements.map((settlement, index) => {
              // Create a temporary group for this single settlement
              const tempGroup: GroupedSettlement = {
                from_member_id: settlement.from_member_id,
                to_member_id: settlement.to_member_id,
                from_nickname: settlement.from_nickname,
                to_nickname: settlement.to_nickname,
                settlements: [settlement],
                total_in_base: 0,
              };

              return (
                <SettlementCard
                  key={index}
                  settlement={settlement}
                  group={tempGroup}
                  recordingSettlements={recordingSettlements}
                  currency={currency}
                  getMemberColor={getMemberColor}
                  membersById={membersById}
                  showPayerPayee={true}
                  onRecordSettlement={handleRecordSettlement}
                  onShowMergeModal={handleShowMergeModal}
                  showConfirm={showConfirm}
                />
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Currency Merge Modal */}
      {showMergeModal && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Convert Debt Currency
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Convert <strong>{Number(showMergeModal.settlement.amount).toFixed(2)} {showMergeModal.settlement.currency}</strong> debt to another currency, then pay in that currency
            </p>

            <div className="space-y-4">
              {/* Show all currencies in this group */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-700 mb-2">Current debts in this pair:</p>
                {showMergeModal.group.settlements.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className={s === showMergeModal.settlement ? 'font-bold text-primary-600' : 'text-gray-600'}>
                      {Number(s.amount).toFixed(2)} {s.currency}
                    </span>
                    {s === showMergeModal.settlement && (
                      <span className="text-xs text-primary-600">← Merging this</span>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Convert to Currency
                </label>
                <select
                  value={mergeToCurrency}
                  onChange={(e) => {
                    const newCurrency = e.target.value;
                    setMergeToCurrency(newCurrency);
                    // Auto-update conversion rate when currency changes
                    const rate = calculateCrossRate(
                      showMergeModal.settlement.currency,
                      newCurrency,
                      exchangeRates,
                      currency
                    );
                    setCustomConversionRate(rate.toString());
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} - {curr.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  After converting, you can pay in this currency
                </p>
              </div>

              {/* Editable conversion rate */}
              {mergeToCurrency && mergeToCurrency !== showMergeModal.settlement.currency && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conversion Rate (1 {showMergeModal.settlement.currency} = ? {mergeToCurrency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      value={customConversionRate}
                      onChange={(e) => setCustomConversionRate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
                      placeholder="e.g., 0.0067"
                    />
                    {ratesLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Rate auto-filled from current exchange rates. You can adjust if needed.
                  </p>
                </div>
              )}

              {/* Show conversion preview */}
              {mergeToCurrency && mergeToCurrency !== showMergeModal.settlement.currency && customConversionRate && parseFloat(customConversionRate) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Original Amount:</span>
                    <span className="font-semibold text-gray-900">
                      {showMergeModal.settlement.amount.toFixed(2)} {showMergeModal.settlement.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-green-300">
                    <span className="text-gray-700">Converted Amount:</span>
                    <span className="font-bold text-green-700">
                      {(showMergeModal.settlement.amount * parseFloat(customConversionRate)).toFixed(2)} {mergeToCurrency}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 mb-2">
                  💡 <strong>How it works:</strong>
                </p>
                <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                  <li>Debt is converted to {mergeToCurrency} using current exchange rate</li>
                  <li>Original {showMergeModal.settlement.currency} debt is removed</li>
                  <li>You can then pay the debt in {mergeToCurrency}</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMergeModal(null);
                  setMergeToCurrency('');
                  setCustomConversionRate('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeSettlement}
                disabled={
                  !mergeToCurrency || 
                  mergeToCurrency === showMergeModal.settlement.currency ||
                  !customConversionRate ||
                  parseFloat(customConversionRate) <= 0
                }
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Convert to {mergeToCurrency}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

