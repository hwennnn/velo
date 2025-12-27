import type { useBalances } from '../../hooks/useBalances';
import type { Debt, TripMember } from '../../types';

export type SettlementDraftState = {
  from_member_id: number;
  to_member_id: number;
  amount: string;
  currency: string;
  notes: string;
  from_nickname?: string;
  to_nickname?: string;
} | null;

export type ConvertDraftState = {
  from_member_id: number;
  to_member_id: number;
  amount: number;
  from_currency: string;
  to_currency: string;
  conversion_rate: string;
  from_nickname?: string;
  to_nickname?: string;
} | null;

export type GroupedDebt = {
  from_id: number;
  to_id: number;
  from_name: string;
  to_name: string;
  rows: Debt[];
  total_base: number;
};

export type MemberBalance = NonNullable<ReturnType<typeof useBalances>['data']>['member_balances'];

export type SummaryTabProps = {
  balances: MemberBalance;
  baseCurrency: string;
  membersById: Map<number, TripMember>;
  expandedMembers: Set<number>;
  onToggleMember: (memberId: number) => void;
};

export type DebtsTabProps = {
  groupedDebts: GroupedDebt[];
  baseCurrency: string;
  membersById: Map<number, TripMember>;
  onSettle: (debt: Debt) => void;
};


