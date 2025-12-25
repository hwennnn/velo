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
    getAll: () => apiClient.get('/trips'),
    getById: (id: string) => apiClient.get(`/trips/${id}`),
    create: (data: any) => apiClient.post('/trips', data),
    update: (id: string, data: any) => apiClient.put(`/trips/${id}`, data),
    delete: (id: string) => apiClient.delete(`/trips/${id}`),
    generateInvite: (tripId: string) => apiClient.post(`/trips/${tripId}/invite`),
    joinViaInvite: (tripId: string) => apiClient.post(`/trips/${tripId}/join`),
    leave: (id: string) => apiClient.post(`/trips/${id}/leave`),
  },

  // Members
  members: {
    getAll: (tripId: string) => apiClient.get(`/trips/${tripId}/members`),
    add: (tripId: string, data: any) => apiClient.post(`/trips/${tripId}/members`, data),
    update: (tripId: string, memberId: string, data: any) => apiClient.put(`/trips/${tripId}/members/${memberId}`, data),
    claim: (tripId: string, memberId: string, data?: any) => 
      apiClient.post(`/trips/${tripId}/members/${memberId}/claim`, data || {}),
    remove: (tripId: string, memberId: string) => 
      apiClient.delete(`/trips/${tripId}/members/${memberId}`)
  },

  // Expenses
  expenses: {
    getAll: (tripId: string, params?: any) => apiClient.get(`/trips/${tripId}/expenses`, { params }),
    getById: (tripId: string, expenseId: number) => apiClient.get(`/trips/${tripId}/expenses/${expenseId}`),
    create: (tripId: string, data: any) => apiClient.post(`/trips/${tripId}/expenses`, data),
    update: (tripId: string, expenseId: number, data: any) => apiClient.put(`/trips/${tripId}/expenses/${expenseId}`, data),
    delete: (tripId: string, expenseId: number) => apiClient.delete(`/trips/${tripId}/expenses/${expenseId}`),
  },

  // Balances & Settlements
  balances: {
    get: (tripId: string) => apiClient.get(`/trips/${tripId}/balances`),
    getSettlements: (tripId: string) => apiClient.get(`/trips/${tripId}/settlements`),
    getMemberBalance: (tripId: string, memberId: number) => apiClient.get(`/trips/${tripId}/members/${memberId}/balance`),
    recordSettlement: (tripId: string, data: any) => apiClient.post(`/trips/${tripId}/settlements`, data),
  },

  // User
  user: {
    register: (data: { user_id: string; email: string }) => apiClient.post('/users/register', data),
    getProfile: () => apiClient.get('/users/me'),
    updateProfile: (data: any) => apiClient.put('/users/me', data),
  },

};

export default apiClient;
