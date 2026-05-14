import type { ParametresSmtpInput } from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'parametres_smtp';

interface ParametresSmtpRow {
  id: string;
  owner_user_id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  from_email: string;
  from_name: string;
  created_at: string;
  updated_at: string;
}

export interface ParametresSmtp {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

function rowToParametres(row: ParametresSmtpRow): ParametresSmtp {
  return {
    id: row.id,
    host: row.host,
    port: Number(row.port),
    username: row.username,
    password: row.password,
    secure: row.secure,
    fromEmail: row.from_email,
    fromName: row.from_name,
  };
}

const queryKey = ['parametres-smtp'] as const;

export function useParametresSmtp() {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<ParametresSmtp | null> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? rowToParametres(data as ParametresSmtpRow) : null;
    },
  });
}

export function useUpsertParametresSmtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ParametresSmtpInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');

      const payload = {
        owner_user_id: user.id,
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        secure: input.secure,
        from_email: input.fromEmail,
        from_name: input.fromName,
      };

      const { error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: 'owner_user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
