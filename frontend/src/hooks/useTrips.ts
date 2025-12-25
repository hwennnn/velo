/**
 * React Query hooks for Trip operations
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { CreateTripInput, Trip } from '../types';

// Query Keys
export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters?: any) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripKeys.details(), id] as const,
};

// Fetch all trips
export function useTrips() {
  return useQuery({
    queryKey: tripKeys.list(),
    queryFn: async () => {
      const response = await api.trips.getAll();
      return response.data.trips as Trip[];
    },
  });
}

// Fetch single trip
export function useTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: tripKeys.detail(tripId!),
    queryFn: async () => {
      const response = await api.trips.getById(tripId!);
      return response.data as Trip;
    },
    enabled: !!tripId,
  });
}

// Create trip mutation
export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTripInput) => {
      const response = await api.trips.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// Update trip mutation
export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.trips.update(tripId, data);
      return response.data as Trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// Delete trip mutation
export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripId: string) => {
      await api.trips.delete(tripId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// Generate invite link mutation
export function useGenerateInvite(tripId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await api.trips.generateInvite(tripId);
      return response.data.invite_url as string;
    },
  });
}

