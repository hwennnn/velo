/**
 * React Query hooks for Member operations
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AddMemberInput } from '../types';
import { tripKeys } from './useTrips';

// Add member mutation
export function useAddMember(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddMemberInput) => {
      const response = await api.members.add(tripId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
    },
  });
}

// Remove member mutation
export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      await api.members.remove(tripId, memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
    },
  });
}

// Update member mutation
export function useUpdateMember(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: Partial<Record<string, unknown>> }) => {
      await api.members.update(tripId, memberId, data);
    },
    onSuccess: () => {
      // Invalidate trip detail (for member list)
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      // Invalidate expenses (nickname may have changed, affects paid_by_nickname and split nicknames)
      queryClient.invalidateQueries({ queryKey: ['expenses', 'list'] });
      // Invalidate balances (also uses member nicknames)
      queryClient.invalidateQueries({ queryKey: ['balances'] });
    },
  });
}

// Leave trip mutation
export function useLeaveTrip(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.trips.leave(tripId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}
