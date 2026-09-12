import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { apiRequest } from './api';
import type { ProgramContext } from './types';

type State={program:ProgramContext|null;loading:boolean;refresh:()=>Promise<void>};
const ProgramContextState=createContext<State|undefined>(undefined);
export function ProgramProvider({children}:{children:ReactNode}){
 const {user,configured}=useAuth();const[program,setProgram]=useState<ProgramContext|null>(null);const[loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{if(!user||!configured){setProgram(null);setLoading(false);return;}setLoading(true);try{const data=await apiRequest<{program:ProgramContext|null}>('program');setProgram(data.program);}catch{setProgram(null);}finally{setLoading(false);}},[user,configured]);
 useEffect(()=>{void refresh();},[refresh]);
 return <ProgramContextState.Provider value={{program,loading,refresh}}>{children}</ProgramContextState.Provider>;
}
export function useProgram(){const value=useContext(ProgramContextState);if(!value)throw new Error('ProgramProvider missing');return value;}
