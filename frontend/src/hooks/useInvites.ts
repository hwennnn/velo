/**
 * React Query hooks for Invite operations
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Query Keys
export const inviteKeys = {
  all: ['invites'] as const,
  decode: (code: string, claim?: number) => [...inviteKeys.all, 'decode', code, claim] as const,
};

// Claimable member (placeholder/pending that can be claimed)
export interface ClaimableMember {
  id: number;
  nickname: string;
  status: 'pending' | 'placeholder';
  invited_email?: string;
}

// Invite info returned from decode API
export interface InviteInfo {
  code: string;
  trip_id: number;
  trip_name: string;
  trip_description: string | null;
  base_currency: string;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
  is_already_member: boolean;
  allow_claim: boolean; // Whether this invite allows claiming existing members
  claimable_members: ClaimableMember[]; // Empty if allow_claim is false
  claim_member_id?: number; // Pre-selected member from personalized link
}

// Decode invite link
export function useDecodeInvite(code: string | undefined, claim?: number) {
  return useQuery({
    queryKey: inviteKeys.decode(code!, claim),
    queryFn: async () => {
      const response = await api.invites.decode(code!, claim);
      return response.data as InviteInfo;
    },
    enabled: !!code,
    retry: false, // Don't retry on 404/410 errors
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

// Join trip mutation
export function useJoinTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, claimMemberId }: { code: string; claimMemberId?: number }) => {
      await api.invites.join(code, claimMemberId);
      // Fetch updated invite info after joining
      const response = await api.invites.decode(code);
      return response.data as InviteInfo;
    },
    onSuccess: (data) => {
      // Update the decode cache with the new data
      queryClient.setQueryData(inviteKeys.decode(data.code), data);
      // Invalidate trips list since user joined a new trip
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

