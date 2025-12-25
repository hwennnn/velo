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
  total_spent: number;
  expense_count: number;
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
  email?: string;
  display_name?: string;  // User's real name (for claimed members)
  avatar_url?: string;
  color?: string;
  created_at?: string;  // When member was created/added
  joined_at?: string;   // When fictional member was claimed
}

export interface Expense {
  id: number;
  trip_id: number;
  description: string;
  amount: number;
  currency: string;
  exchange_rate_to_base: number;
  amount_in_base_currency: number;
  paid_by_member_id: number;
  paid_by_nickname: string;
  expense_date: string;
  category?: string;
  notes?: string;
  receipt_url?: string;
  created_by: string;
  splits: Split[];
}

export interface Split {
  id: number;
  member_id: number;
  member_nickname: string;
  amount: number;
  percentage?: number;
}

export interface Balance {
  member_id: number;
  member_nickname: string;
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

export interface Settlement {
  from_member_id: number;
  to_member_id: number;
  amount: number;
  from_member?: TripMember;
  to_member?: TripMember;
  from_nickname: string;
  to_nickname: string;
}

export interface CreateTripInput {
  name: string;
  description?: string;
  base_currency: string;
  start_date?: string;
  end_date?: string;
}

export interface AddMemberInput {
  nickname: string;
  is_fictional: boolean;
  user_email?: string;
  is_admin: boolean;
}

export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency: string;
  paid_by_member_id: number;
  expense_date: string;
  category?: string;
  notes?: string;
  receipt_url?: string;
  split_type: 'equal' | 'percentage' | 'custom';
  splits?: SplitInput[];
}

export interface SplitInput {
  member_id: number;
  amount?: number;
  percentage?: number;
}

export interface InviteLink {
  invite_code: string;
  invite_url: string;
  expires_at?: string;
}
