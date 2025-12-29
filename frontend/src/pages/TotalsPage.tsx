/**
 * Totals Page
 * 
 * Shows each person's share of the trip expenses.
 * Includes a visual breakdown chart.
 */
import { ArrowLeft, DollarSign } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Shimmer } from '../components/Shimmer';
import { useTotals } from '../hooks/useTotals';
import { useTrip } from '../hooks/useTrips';

// Colors for the chart segments
const CHART_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#84CC16', // lime
];

export default function TotalsPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();

    const { data: trip } = useTrip(tripId);
    const { data: totalsData, isLoading } = useTotals(tripId);

    const baseCurrency = trip?.base_currency || totalsData?.base_currency || 'USD';
    const totalSpent = totalsData?.total_spent || 0;
    const memberTotals = totalsData?.member_totals || [];

    // Create a map of members for avatar data
    const membersById = useMemo(() =>
        new Map((trip?.members || []).map((m) => [m.id, m])),
        [trip?.members]
    );

    // Sort by share descending and calculate percentages
    const sortedMemberTotals = useMemo(() => {
        return [...memberTotals]
            .sort((a, b) => b.total_share - a.total_share)
            .map((m, idx) => ({
                ...m,
                percentage: totalSpent > 0 ? (m.total_share / totalSpent) * 100 : 0,
                color: CHART_COLORS[idx % CHART_COLORS.length],
            }));
    }, [memberTotals, totalSpent]);

    const formatCurrency = (amount: number) => {
        const formatted = Math.abs(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `${baseCurrency} ${formatted}`;
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
                            <div className="text-lg font-semibold text-gray-900">Spending Breakdown</div>
                            <div className="text-xs text-gray-500">
                                Each person's share of the trip
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-5 py-4 pb-4">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Shimmer className="h-48 rounded-xl" />
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <Shimmer key={i} className="h-16 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    ) : sortedMemberTotals.length === 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No expense data available</p>
                        </div>
                    ) : (
                        <>
                            {/* Trip Total Summary Card */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                                <p className="text-sm text-gray-500 uppercase tracking-wide font-medium mb-1">
                                    Trip Total
                                </p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {formatCurrency(totalSpent)}
                                </p>
                            </div>

                            {/* Visual Bar Chart */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                                <p className="text-sm text-gray-500 uppercase tracking-wide font-medium mb-3">
                                    Share Distribution
                                </p>

                                {/* Stacked horizontal bar */}
                                <div className="h-8 rounded-full overflow-hidden flex bg-gray-100 mb-4">
                                    {sortedMemberTotals.map((member) => (
                                        <div
                                            key={member.member_id}
                                            style={{
                                                width: `${member.percentage}%`,
                                                backgroundColor: member.color,
                                            }}
                                            className="h-full transition-all duration-300"
                                            title={`${member.member_nickname}: ${member.percentage.toFixed(1)}%`}
                                        />
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-3">
                                    {sortedMemberTotals.map((member) => (
                                        <div key={member.member_id} className="flex items-center gap-1.5">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: member.color }}
                                            />
                                            <span className="text-xs text-gray-600">
                                                {member.member_nickname} ({member.percentage.toFixed(0)}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Member Share List */}
                            <p className="text-sm text-gray-500 uppercase tracking-wide font-medium mb-3 px-1">
                                Individual Shares
                            </p>
                            <div className="space-y-2">
                                {sortedMemberTotals.map((memberTotal) => {
                                    const member = membersById.get(memberTotal.member_id);

                                    return (
                                        <div
                                            key={memberTotal.member_id}
                                            className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                                        >
                                            {/* Color indicator */}
                                            <div
                                                className="w-1 h-10 rounded-full shrink-0"
                                                style={{ backgroundColor: memberTotal.color }}
                                            />

                                            {/* Avatar */}
                                            <Avatar
                                                size="sm"
                                                className="w-10 h-10 shrink-0"
                                                member={{
                                                    id: memberTotal.member_id,
                                                    nickname: member?.nickname ?? memberTotal.member_nickname,
                                                    display_name: member?.display_name,
                                                    avatar_url: member?.avatar_url,
                                                }}
                                            />

                                            {/* Name */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-gray-900 truncate">
                                                    {memberTotal.member_nickname}
                                                </h4>
                                                <p className="text-xs text-gray-500">
                                                    {memberTotal.percentage.toFixed(1)}% of total
                                                </p>
                                            </div>

                                            {/* Amount */}
                                            <div className="text-right shrink-0">
                                                <p className="font-semibold text-gray-900">
                                                    {formatCurrency(memberTotal.total_share)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
