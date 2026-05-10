import type { Session } from '@supabase/supabase-js';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from './supabase';

const sessionQueryKey = ['auth', 'session'] as const;

export const sessionQueryOptions = queryOptions<Session | null>({
  queryKey: sessionQueryKey,
  queryFn: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
  staleTime: Infinity,
});

export function useSession() {
  return useQuery(sessionQueryOptions);
}

export function useSyncAuthState() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(sessionQueryKey, session);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
