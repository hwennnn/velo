/**
 * Balances Page
 *
 * Shows member balance summary only.
 * Settle up functionality is now in /trips/:tripId/settle-up
 */
import { ArrowLeft, DollarSign, Shield } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shimmer } from '../components/Shimmer';
import { useAuth } from '../hooks/useAuth';
import { useBalances } from '../hooks/useBalances';
import { useTrip } from '../hooks/useTrips';
import { SummaryTab } from './balances/SummaryTab';

export default function BalancesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(new Set());

  const { data: trip } = useTrip(tripId);
  const { data: balancesData, isLoading } = useBalances(tripId, { minimize: true });

  const baseCurrency = trip?.base_currency || balancesData?.base_currency || 'USD';
  const balances = balancesData?.member_balances || [];
  const debts = balancesData?.debts || [];

  const membersById = useMemo(() => new Map((trip?.members || []).map((m) => [m.id, m])), [trip?.members]);

  // Find current user's member ID and sort balances to show current user first
  const currentMember = trip?.members?.find(m => m.user_id === user?.id);
  const sortedBalances = useMemo(() => {
    if (!currentMember) return balances;
    return [...balances].sort((a, b) => {
      if (a.member_id === currentMember.id) return -1;
      if (b.member_id === currentMember.id) return 1;
      return 0;
    });
  }, [balances, currentMember]);

  const toggleMemberExpansion = (memberId: number) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

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
              <div className="text-lg font-semibold text-gray-900">Balances</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <Shield className="w-3 h-3 text-gray-400" />
                <span>Base: {baseCurrency}</span>
              </div>
            </div>
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
          ) : balances.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No balance data available</p>
            </div>
          ) : (
            <SummaryTab
              balances={sortedBalances}
              baseCurrency={baseCurrency}
              membersById={membersById}
              expandedMembers={expandedMembers}
              onToggleMember={toggleMemberExpansion}
              debts={debts}
            />
          )}
        </div>
      </div>
    </div>
  );
}

