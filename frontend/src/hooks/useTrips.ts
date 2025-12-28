/**
 * React Query hooks for Trip operations
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { CreateTripInput, Trip } from '../types';
import { balanceKeys } from './useBalances';

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

// Fetch single trip (with initial data from list cache for faster FMP)
export function useTrip(tripId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: tripKeys.detail(tripId!),
    queryFn: async () => {
      const response = await api.trips.getById(tripId!);
      return response.data as Trip;
    },
    enabled: !!tripId,
    // Use cached trip from list for instant display while fetching fresh data
    initialData: () => {
      const trips = queryClient.getQueryData<Trip[]>(tripKeys.list());
      return trips?.find((t) => t.id === Number(tripId));
    },
    initialDataUpdatedAt: () => {
      return queryClient.getQueryState(tripKeys.list())?.dataUpdatedAt;
    },
  });
}

// Create trip mutation with optimistic update
export function useCreateTrip(currentUserId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTripInput) => {
      const response = await api.trips.create(data);
      return response.data;
    },
    onMutate: async (newTripData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: tripKeys.lists() });
      
      // Snapshot for rollback
      const previousTrips = queryClient.getQueryData<Trip[]>(tripKeys.list());
      
      // Build optimistic trip
      const optimisticId = `optimistic-trip-${Date.now()}`;
      const optimisticTrip: Trip = {
        id: -Date.now(), // Temporary negative ID
        name: newTripData.name,
        description: newTripData.description || '',
        base_currency: newTripData.base_currency,
        simplify_debts: false, // Default value for new trips
        start_date: newTripData.start_date,
        end_date: newTripData.end_date,
        created_by: currentUserId || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_spent: 0,
        expense_count: 0,
        member_count: 1,
        _isOptimistic: true,
        _optimisticId: optimisticId,
      };
      
      // Optimistically add to trip list
      queryClient.setQueryData<Trip[]>(
        tripKeys.list(),
        (old) => old ? [optimisticTrip, ...old] : [optimisticTrip]
      );
      
      return { previousTrips, optimisticId };
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic trip with real data
      queryClient.setQueryData<Trip[]>(
        tripKeys.list(),
        (old) => old ? old.map(trip => 
          trip._optimisticId === context?.optimisticId 
            ? { ...data, _isOptimistic: false } 
            : trip
        ) : [data]
      );
      
      // Invalidate to ensure sync
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousTrips) {
        queryClient.setQueryData(tripKeys.list(), context.previousTrips);
      }
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
      // Also invalidate balances since simplify_debts affects balance calculation
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
    },
  });
}

// Delete trip mutation
export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripId: string) => {
      await api.trips.delete(tripId);
      return tripId;
    },
    onSuccess: (tripId) => {
      // Invalidate both list and detail to prevent stale cache access
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// Query keys for invites
export const inviteKeys = {
  all: ['invites'] as const,
  trip: (tripId: string) => [...inviteKeys.all, tripId] as const,
};

// Invite link response type
interface InviteLinkData {
  invite_code: string;
  invite_url: string;
  expires_at: string | null;
}

// Generate/get invite link - uses query for caching
// Call refetch() to generate a new one or extend expiration
export function useInviteLink(tripId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: inviteKeys.trip(tripId),
    queryFn: async () => {
      const response = await api.trips.generateInvite(tripId);
      return response.data as InviteLinkData;
    },
    enabled: options?.enabled ?? false, // Only fetch when modal opens
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}


