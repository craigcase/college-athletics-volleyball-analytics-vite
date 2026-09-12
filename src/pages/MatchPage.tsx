import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { MatchSummary } from '../components/MatchSummary';
import { apiRequest } from '../lib/api';
import { useProgram } from '../lib/program';
import type { MatchSummaryData } from '../lib/types';
export function MatchPage(){const{program}=useProgram();const{matchId}=useParams();const[summary,setSummary]=useState<MatchSummaryData|null>(null);useEffect(()=>{if(matchId)void apiRequest<{summary:MatchSummaryData}>(`match-summary?matchId=${encodeURIComponent(matchId)}`).then(d=>setSummary(d.summary));},[matchId]);if(!program)return null;return <AppShell program={program}><Link className="back-link" to="/matches">← All Matches</Link>{summary?<MatchSummary summary={summary}/>:<div className="empty-panel">Loading match summary…</div>}</AppShell>}
