import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, supabaseConfigured } from './supabase';

type AuthState={configured:boolean;loading:boolean;session:Session|null;user:User|null;signOut:()=>Promise<void>};
const AuthContext=createContext<AuthState|undefined>(undefined);
export function AuthProvider({children}:{children:ReactNode}){
  const configured=supabaseConfigured();
  const [session,setSession]=useState<Session|null>(null);
  const [loading,setLoading]=useState(configured);
  useEffect(()=>{
    if(!configured){setLoading(false);return;}
    const supabase=getSupabaseClient();
    void supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false);});
    return()=>data.subscription.unsubscribe();
  },[configured]);
  const value=useMemo<AuthState>(()=>({configured,loading,session,user:session?.user??null,signOut:async()=>{if(configured)await getSupabaseClient().auth.signOut();}}),[configured,loading,session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value;}
