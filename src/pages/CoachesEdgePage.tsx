import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { CoachesEdgeInput } from '../components/CoachesEdgeInput';
import { apiRequest } from '../lib/api';
import { useProgram } from '../lib/program';
import type { MatchRow } from '../lib/types';
export function CoachesEdgePage(){const{program}=useProgram();const[matches,setMatches]=useState<MatchRow[]>([]);const[params]=useSearchParams();useEffect(()=>{void apiRequest<{matches:MatchRow[]}>('matches').then(d=>setMatches(d.matches));},[]);if(!program)return null;return <AppShell program={program}><div className="edge-head"><span className="eyebrow">Evidence-driven assistant coach</span><h1>Coach's Edge</h1><p>Ask the question. The analytics engine supplies the numbers; Coach's Edge explains only what stored evidence supports.</p></div>{matches.length?<CoachesEdgeInput matches={matches} initialMatchId={params.get('matchId')??undefined}/>:<div className="empty-panel"><h3>No matches to analyze yet</h3><p>Import your schedule and match evidence first.</p></div>}</AppShell>}
