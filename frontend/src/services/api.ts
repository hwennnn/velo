/**
 * API client for backend communication
 * Handles all HTTP requests to the FastAPI backend
 */
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { supabase } from './supabase';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: env.api.baseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Get Supabase session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - sign out
      await supabase.auth.signOut();
      window.location.href = '/auth/login';
    }
    
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Trips
  trips: {
    getAll: () => apiClient.get('/trips/'),
    getById: (id: string) => apiClient.get(`/trips/${id}`),
    create: (data: Partial<Record<string, unknown>>) => apiClient.post('/trips', data),
    update: (id: string, data: Partial<Record<string, unknown>>) => apiClient.put(`/trips/${id}`, data),
    delete: (id: string) => apiClient.delete(`/trips/${id}`),
    generateInvite: (tripId: string, allowClaim?: boolean) => 
      apiClient.post(`/trips/${tripId}/invite`, allowClaim !== undefined ? { allow_claim: allowClaim } : {}),
    leave: (id: string) => apiClient.post(`/trips/${id}/leave`),
  },

  // Invites (new secure invite system)
  invites: {
    decode: (code: string, claim?: number) => {
      const params = claim !== undefined ? { claim } : undefined;
      return apiClient.get(`/invites/${code}`, { params });
    },
    join: (code: string, claimMemberId?: number) => 
      apiClient.post(`/invites/${code}/join`, claimMemberId ? { claim_member_id: claimMemberId } : {}),
  },

  // Members
  members: {
    getAll: (tripId: string) => apiClient.get(`/trips/${tripId}/members`),
    add: (tripId: string, data: Partial<Record<string, unknown>>) => apiClient.post(`/trips/${tripId}/members`, data),
    update: (tripId: string, memberId: string, data: Partial<Record<string, unknown>>) => apiClient.put(`/trips/${tripId}/members/${memberId}`, data),
    claim: (tripId: string, memberId: string, data?: Partial<Record<string, unknown>>) => 
      apiClient.post(`/trips/${tripId}/members/${memberId}/claim`, data || {}),
    remove: (tripId: string, memberId: string) => 
      apiClient.delete(`/trips/${tripId}/members/${memberId}`),
    generateInvite: (tripId: string, memberId: string) =>
      apiClient.post(`/trips/${tripId}/members/${memberId}/invite`),
  },

  // Expenses
  expenses: {
    getAll: (tripId: string, params?: Partial<Record<string, unknown>>) => apiClient.get(`/trips/${tripId}/expenses`, { params }),
    getById: (tripId: string, expenseId: number) => apiClient.get(`/trips/${tripId}/expenses/${expenseId}`),
    create: (tripId: string, data: Partial<Record<string, unknown>>) => apiClient.post(`/trips/${tripId}/expenses`, data),
    update: (tripId: string, expenseId: number, data: Partial<Record<string, unknown>>) => apiClient.put(`/trips/${tripId}/expenses/${expenseId}`, data),
    delete: (tripId: string, expenseId: number) => apiClient.delete(`/trips/${tripId}/expenses/${expenseId}`),
  },

  balances: {
    get: (tripId: string, minimize?: boolean) => {
      const params: Record<string, boolean> = {};
      if (minimize !== undefined) params.minimize = minimize;
      return Object.keys(params).length > 0
        ? apiClient.get(`/trips/${tripId}/balances`, { params })
        : apiClient.get(`/trips/${tripId}/balances`);
    },
    getSettlements: (tripId: string, simplify?: boolean) =>
      simplify === undefined
        ? apiClient.get(`/trips/${tripId}/settlements`)
        : apiClient.get(`/trips/${tripId}/settlements`, { params: { simplify } }),
    getMemberBalance: (tripId: string, memberId: number) => 
      apiClient.get(`/trips/${tripId}/members/${memberId}/balance`),
    createSettlement: (tripId: string, data: Partial<Record<string, unknown>>) => 
      apiClient.post(`/trips/${tripId}/settlements`, data),
    recordSettlement: (tripId: string, data: Partial<Record<string, unknown>>) => 
      apiClient.post(`/trips/${tripId}/settlements`, data),
    mergeDebtCurrency: (tripId: string, data: Partial<Record<string, unknown>>) => 
      apiClient.post(`/trips/${tripId}/debts/merge`, data),
    convertAllDebts: (tripId: string, data: Partial<Record<string, unknown>>) => 
      apiClient.post(`/trips/${tripId}/debts/convert-all`, data),
    getTotals: (tripId: string) => apiClient.get(`/trips/${tripId}/totals`),
  },

  // Exchange Rates
  exchangeRates: {
    get: (baseCurrency: string) => apiClient.get(`/exchange-rates/${baseCurrency}`),
  },

  // User
  user: {
    register: (data: { user_id: string; email: string; display_name?: string; avatar_url?: string }) => apiClient.post('/users/register', data),
    getProfile: () => apiClient.get('/users/me'),
    updateProfile: (data: Partial<Record<string, unknown>>) => apiClient.put('/users/me', data),
    uploadAvatar: (formData: FormData) => apiClient.post('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  },
};

export default apiClient;
