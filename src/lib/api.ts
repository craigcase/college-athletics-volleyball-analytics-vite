import { getSupabaseClient, supabaseConfigured } from './supabase';

const functionsBase='/.netlify/functions';
async function token(){
  if(!supabaseConfigured())throw new Error('Supabase is not configured yet.');
  const {data}=await getSupabaseClient().auth.getSession();
  const accessToken=data.session?.access_token;
  if(!accessToken)throw new Error('Authentication required.');
  return accessToken;
}
export async function apiRequest<T>(fn:string, init:RequestInit={}):Promise<T>{
  const accessToken=await token();
  const headers=new Headers(init.headers);
  headers.set('authorization',`Bearer ${accessToken}`);
  const response=await fetch(`${functionsBase}/${fn}`,{...init,headers});
  const data=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
  if(!response.ok)throw new Error((data as any).error??`Request failed (${response.status}).`);
  return data as T;
}
export async function apiJson<T>(fn:string,body:unknown){return apiRequest<T>(fn,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
