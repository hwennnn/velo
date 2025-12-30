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
  simplify_debts?: boolean;
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  total_spent: number;
  expense_count: number;
  member_count?: number;
  members?: TripMember[];
  // Optimistic update fields
  _isOptimistic?: boolean;
  _optimisticId?: string;
}

export interface TripMember {
  id: number;
  trip_id?: number;
  user_id?: string;
  nickname: string;
  status: 'active' | 'pending' | 'placeholder';
  is_admin: boolean;
  email?: string;
  display_name?: string;  // User's real name
  avatar_url?: string;
  color?: string;
  invited_email?: string;  // For pending members
  invited_at?: string;     // When invitation was sent
  created_at?: string;     // When member was created/added
  joined_at?: string;      // When member joined (pending->active)
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
  created_at: string;
  updated_at: string;
  category?: string;
  notes?: string;
  receipt_urls?: string[];
  expense_type: string; // 'expense' or 'settlement'
  created_by: string;
  splits: Split[];
  // Optimistic update fields
  _isOptimistic?: boolean;
  _optimisticId?: string;
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
  total_owed: number; // What they owe to others (in BASE CURRENCY)
  total_owed_to: number; // What others owe them (in BASE CURRENCY)
  net_balance: number; // total_owed_to - total_owed (in BASE CURRENCY)
  currency_balances: Record<string, number>; // Per-currency balances (original currencies)
}

export interface Debt {
  from_member_id: number;
  to_member_id: number;
  from_nickname: string;
  to_nickname: string;
  amount: number;
  currency: string;
  amount_in_base: number;
}

export interface Settlement extends Debt {
  // Settlement is the same as Debt
  from_member?: TripMember;
  to_member?: TripMember;
}

export interface GroupedSettlement {
  from_member_id: number;
  to_member_id: number;
  from_nickname: string;
  to_nickname: string;
  settlements: Settlement[]; // Multiple settlements in different currencies
  total_in_base: number; // Total amount in base currency
}

export interface SettlementInput {
  from_member_id: number;
  to_member_id: number;
  amount: number;
  currency: string;
  notes?: string;
  convert_to_currency?: string; // Optional: convert payment to this currency
  conversion_rate?: number; // Optional: conversion rate if converting
}

export interface CreateTripInput {
  name: string;
  description?: string;
  base_currency: string;
  start_date?: string;
  end_date?: string;
  [key: string]: unknown; // Allow additional properties for API compatibility
}

export interface AddMemberInput {
  nickname: string;
  email?: string;  // If provided: pending (or active if user exists). If not: placeholder
  is_admin: boolean;
  [key: string]: unknown; // Allow additional properties for API compatibility
}

export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency: string;
  paid_by_member_id: number;
  category?: string;
  notes?: string;
  receipt_urls?: string[];
  split_type: 'equal' | 'percentage' | 'custom';
  splits?: SplitInput[];
  expense_type?: 'expense' | 'settlement';
  [key: string]: unknown; // Allow additional properties for API compatibility
}

export interface SplitInput {
  member_id: number;
  amount?: number;
  percentage?: number;
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  currency?: string;
  paid_by_member_id?: number;
  category?: string;
  notes?: string;
  receipt_urls?: string[];
  split_type?: 'equal' | 'percentage' | 'custom';
  splits?: SplitInput[];
  [key: string]: unknown; // Allow additional properties for API compatibility
}

export interface BalancesResponse {
  trip_id: number;
  base_currency: string;
  simplified: boolean;
  minimized: boolean;
  member_balances: Balance[];
  debts: Debt[];
}

export interface BulkConversionRequest {
  target_currency: string;
  use_custom_rates: boolean;
  custom_rates?: Record<string, number>;
  [key: string]: unknown; // Allow additional properties for API compatibility
}

export interface InviteLink {
  invite_code: string;
  invite_url: string;
  expires_at?: string;
}

export interface MemberTotal {
  member_id: number;
  member_nickname: string;
  total_paid: number;    // What they paid (in base currency)
  total_share: number;   // Their share of expenses (in base currency)
  difference: number;    // total_paid - total_share (positive = overpaid)
}

export interface TotalsResponse {
  trip_id: number;
  base_currency: string;
  total_spent: number;
  member_totals: MemberTotal[];
}

