import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
export function supabaseConfigured(){return Boolean(import.meta.env.VITE_SUPABASE_URL?.trim()&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim());}
export function getSupabaseClient(){
  if(client)return client;
  const url=import.meta.env.VITE_SUPABASE_URL?.trim();
  const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if(!url||!key)throw new Error('SUPABASE_NOT_CONFIGURED');
  client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
