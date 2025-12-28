/**
 * Settle Up Page
 *
 * Displays debts list and allows settling up / converting currencies
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SettleUpInfoModal } from '../components/SettleUpInfoModal';
import { Shimmer } from '../components/Shimmer';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { balanceKeys, useBalances, useCreateSettlement } from '../hooks/useBalances';
import { calculateCrossRate, useExchangeRates } from '../hooks/useExchangeRates';
import { tripKeys, useTrip } from '../hooks/useTrips';
import { api } from '../services/api';
import type { Debt } from '../types';
import { DebtsTab } from './balances/DebtsTab';
import { SettleConvertModal } from './balances/SettleConvertModal';
import type { ConvertDraftState, GroupedDebt, SettlementDraftState } from './balances/types';

export default function SettleUpPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();
    const { user } = useAuth();

    const { data: trip } = useTrip(tripId);
    const { data: balancesData, isLoading } = useBalances(tripId);
    const createSettlement = useCreateSettlement(tripId || '', trip?.members, user?.id);
    const queryClient = useQueryClient();

    const baseCurrency = trip?.base_currency || balancesData?.base_currency || 'USD';

    const { data: exchangeRatesData, isLoading: ratesLoading } = useExchangeRates(baseCurrency);

    const membersById = useMemo(() => new Map((trip?.members || []).map((m) => [m.id, m])), [trip?.members]);

    const [settlementDraft, setSettlementDraft] = useState<SettlementDraftState>(null);
    const [modalView, setModalView] = useState<'settle' | 'convert'>('settle');
    const [convertDraft, setConvertDraft] = useState<ConvertDraftState>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [draftSource, setDraftSource] = useState<'debt' | 'manual' | null>(null);

    const exchangeRates = useMemo(() => exchangeRatesData?.rates || { [baseCurrency]: 1 }, [exchangeRatesData?.rates, baseCurrency]);

    // Show info modal on first visit (per session)
    useEffect(() => {
        const hasSeenInfo = sessionStorage.getItem('settleup-info-seen');
        if (!hasSeenInfo && trip) {
            setShowInfoModal(true);
        }
    }, [trip]);

    const handleCloseInfoModal = () => {
        sessionStorage.setItem('settleup-info-seen', 'true');
        setShowInfoModal(false);
    };

    const mergeDebtMutation = useMutation({
        mutationFn: (mergeData: {
            from_member_id: number;
            to_member_id: number;
            amount: number;
            from_currency: string;
            to_currency: string;
            conversion_rate: number;
        }) => api.balances.mergeDebtCurrency(tripId || '', mergeData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId || '') });
            queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId || '') });
            showAlert('Debt converted successfully', { type: 'success' });
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { detail?: string } } };
            showAlert(err.response?.data?.detail || 'Failed to convert debt', { type: 'error' });
        },
    });

    const openSettlementDraftFromDebt = (debt: Debt) => {
        const defaultRate = calculateCrossRate(debt.currency, baseCurrency, exchangeRates, baseCurrency);
        setDraftSource('debt');
        setSettlementDraft({
            from_member_id: debt.from_member_id,
            to_member_id: debt.to_member_id,
            amount: Number(debt.amount).toFixed(2),
            currency: debt.currency,
            notes: `Settlement: ${debt.from_nickname} → ${debt.to_nickname}`,
            from_nickname: debt.from_nickname,
            to_nickname: debt.to_nickname,
        });
        setModalView('settle');
        setConvertDraft({
            from_member_id: debt.from_member_id,
            to_member_id: debt.to_member_id,
            amount: Number(debt.amount),
            from_currency: debt.currency,
            to_currency: baseCurrency,
            conversion_rate: defaultRate.toString(),
            from_nickname: debt.from_nickname,
            to_nickname: debt.to_nickname,
        });
    };

    const openManualSettlementDraft = () => {
        const members = trip?.members || [];
        const from = members[0];
        const to = members[1];

        if (!from || !to) {
            showAlert('Need at least 2 members to create a settlement', { type: 'error' });
            return;
        }

        setSettlementDraft({
            from_member_id: from.id,
            to_member_id: to.id,
            amount: '',
            currency: baseCurrency,
            notes: 'Settlement',
            from_nickname: from.nickname,
            to_nickname: to.nickname,
        });
        setDraftSource('manual');
        setModalView('settle');
        setConvertDraft(null);
    };

    const handleConvertCurrencyChange = (newCurrency: string) => {
        if (!convertDraft) return;
        const nextRate = calculateCrossRate(
            convertDraft.from_currency,
            newCurrency,
            exchangeRates,
            baseCurrency
        );
        setConvertDraft(prev => prev ? { ...prev, to_currency: newCurrency, conversion_rate: nextRate.toString() } : prev);
    };

    const convertedAmount = useMemo(() => {
        if (!convertDraft) return 0;
        const rate = parseFloat(convertDraft.conversion_rate);
        if (!rate || Number.isNaN(rate)) return 0;
        return convertDraft.amount * rate;
    }, [convertDraft]);

    const submitConvertDraft = async () => {
        if (!convertDraft) return;

        const amountNum = Number(convertDraft.amount);
        if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
            showAlert('Please enter a valid amount before converting', { type: 'error' });
            return;
        }

        const rate = parseFloat(convertDraft.conversion_rate);
        if (!rate || Number.isNaN(rate) || rate <= 0) {
            showAlert('Please enter a valid conversion rate', { type: 'error' });
            return;
        }

        const confirmed = await showConfirm(
            `Convert ${amountNum.toFixed(2)} ${convertDraft.from_currency} owed by ${convertDraft.from_nickname || 'payer'} to ${convertDraft.to_nickname || 'receiver'} into ${convertDraft.to_currency}?`,
            {
                title: 'Convert Debt Currency',
                confirmText: 'Convert',
                cancelText: 'Cancel',
            }
        );
        if (!confirmed) return;

        try {
            await mergeDebtMutation.mutateAsync({
                from_member_id: convertDraft.from_member_id,
                to_member_id: convertDraft.to_member_id,
                amount: amountNum,
                from_currency: convertDraft.from_currency,
                to_currency: convertDraft.to_currency,
                conversion_rate: rate,
            });
            setSettlementDraft(null);
            setConvertDraft(null);
        } catch {
            // handled by mutation
        }
    };

    const closeDraft = () => {
        setSettlementDraft(null);
        setConvertDraft(null);
    };

    const submitSettlementDraft = async () => {
        if (!settlementDraft || !tripId) return;

        const amountNum = parseFloat(settlementDraft.amount);
        if (!settlementDraft.amount || Number.isNaN(amountNum) || amountNum <= 0) {
            showAlert('Please enter a valid amount', { type: 'error' });
            return;
        }

        if (settlementDraft.from_member_id === settlementDraft.to_member_id) {
            showAlert('Cannot settle with yourself', { type: 'error' });
            return;
        }

        const confirmed = await showConfirm(
            `Create settlement: ${settlementDraft.from_nickname || 'Member'} pays ${amountNum.toFixed(2)} ${settlementDraft.currency} to ${settlementDraft.to_nickname || 'Member'}?`,
            {
                title: 'Confirm Settlement',
                confirmText: 'Settle Up',
                cancelText: 'Cancel',
            }
        );
        if (!confirmed) return;

        try {
            await createSettlement.mutateAsync({
                from_member_id: settlementDraft.from_member_id,
                to_member_id: settlementDraft.to_member_id,
                amount: amountNum,
                currency: settlementDraft.currency,
                notes: settlementDraft.notes,
            });
            showAlert('Settlement created', { type: 'success' });
            closeDraft();
        } catch {
            showAlert('Failed to create settlement', { type: 'error' });
        }
    };

    // Group debts by (from -> to) to show one card per pair, with per-currency rows
    const groupedDebts = useMemo(() => {
        const debts = balancesData?.debts || [];

        const map = new Map<string, GroupedDebt>();
        debts.forEach((d) => {
            const key = `${d.from_member_id}-${d.to_member_id}`;
            const existing = map.get(key);
            if (existing) {
                existing.rows.push(d);
                existing.total_base += d.amount_in_base ?? 0;
                existing.totals_by_currency[d.currency] = (existing.totals_by_currency[d.currency] || 0) + Number(d.amount);
            } else {
                map.set(key, {
                    from_id: d.from_member_id,
                    to_id: d.to_member_id,
                    from_name: d.from_nickname,
                    to_name: d.to_nickname,
                    rows: [d],
                    total_base: d.amount_in_base ?? 0,
                    totals_by_currency: { [d.currency]: Number(d.amount) },
                });
            }
        });
        return Array.from(map.values());
    }, [balancesData?.debts]);

    if (!tripId) return null;

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/trips/${tripId}`)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <div>
                            <div className="text-lg font-semibold text-gray-900">Settle Up</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <Shield className="w-3 h-3 text-gray-400" />
                                <span>Base: {baseCurrency}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openManualSettlementDraft}
                            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4" />
                            New settlement
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-5 py-4 pb-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Shimmer className="w-12 h-12 rounded-full" />
                                            <div className="flex-1">
                                                <Shimmer className="h-4 rounded w-24 mb-2" />
                                                <Shimmer className="h-3 rounded w-32" />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Shimmer className="h-6 rounded w-16 mb-1" />
                                            <Shimmer className="h-3 rounded w-12" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <DebtsTab
                            groupedDebts={groupedDebts}
                            baseCurrency={baseCurrency}
                            membersById={membersById}
                            onSettle={openSettlementDraftFromDebt}
                        />
                    )}
                </div>
            </div>

            {/* Settlement popup */}
            {settlementDraft && (
                <SettleConvertModal
                    settlementDraft={settlementDraft}
                    convertDraft={convertDraft}
                    modalView={modalView}
                    setModalView={setModalView}
                    setSettlementDraft={setSettlementDraft}
                    setConvertDraft={setConvertDraft}
                    onClose={closeDraft}
                    onSubmitSettlement={submitSettlementDraft}
                    onSubmitConvert={submitConvertDraft}
                    onConvertCurrencyChange={handleConvertCurrencyChange}
                    ratesLoading={ratesLoading}
                    convertedAmount={convertedAmount}
                    members={trip?.members || []}
                    membersById={membersById}
                    createPending={createSettlement.isPending}
                    convertPending={mergeDebtMutation.isPending}
                    allowConvertTab={draftSource === 'debt'}
                    lockParticipants={draftSource === 'debt'}
                    lockConvertAmount={draftSource === 'debt'}
                />
            )}

            {/* Info Modal */}
            <SettleUpInfoModal isOpen={showInfoModal} onClose={handleCloseInfoModal} />
        </div>
    );
}
