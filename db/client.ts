import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let adminClient:SupabaseClient|undefined;
export function getAdminClient(){if(adminClient)return adminClient;const url=process.env.SUPABASE_URL?.trim();const key=process.env.SUPABASE_SECRET_KEY?.trim();if(!url||!key)throw new Error('SUPABASE_ADMIN_NOT_CONFIGURED');adminClient=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});return adminClient;}
export function getEvidenceBucket(){return process.env.SUPABASE_EVIDENCE_BUCKET?.trim()||'volleyball-evidence';}
