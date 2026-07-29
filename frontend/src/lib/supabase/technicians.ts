import { getSupabaseClient } from '@/lib/supabase';
import type { Technician } from '@/lib/types';

export async function listTechnicians(): Promise<Technician[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('technicians')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}
