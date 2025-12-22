/**
 * TypeScript type definitions
 */

export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Trip {
  id: number;
  name: string;
  description?: string;
  base_currency: string;
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  members?: TripMember[];
}

export interface TripMember {
  id: number;
  trip_id?: number;
  user_id?: string;
  nickname: string;
  is_fictional: boolean;
  is_admin: boolean;
  color?: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  currency: string;
  exchange_rate_to_base: number;
  paid_by_member_id: string;
  date: string;
  category?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  paid_by?: TripMember;
  splits?: Split[];
}

export interface Split {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  member?: TripMember;
}

export interface Balance {
  member_id: string;
  member: TripMember;
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

export interface Settlement {
  from_member_id: string;
  to_member_id: string;
  amount: number;
  from_member?: TripMember;
  to_member?: TripMember;
}

export interface CreateTripInput {
  name: string;
  description?: string;
  base_currency: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency: string;
  paid_by_member_id: string;
  date: string;
  category?: string;
  notes?: string;
  split_equally?: boolean;
  custom_splits?: { member_id: string; amount: number }[];
}
