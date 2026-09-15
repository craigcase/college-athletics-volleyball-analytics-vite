import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { MatchSummary } from '../components/MatchSummary';
import { MatchDataQuality } from '../components/MatchDataQuality';
import { apiRequest } from '../lib/api';
import { useProgram } from '../lib/program';
import type { MatchSummaryData } from '../lib/types';
export function MatchPage(){const{program}=useProgram();const{matchId}=useParams();const location=useLocation();const[summary,setSummary]=useState<MatchSummaryData|null>(null),[showQuality,setShowQuality]=useState(location.hash==='#data-quality');const loadSummary=useCallback(async()=>{if(!matchId)return;const d=await apiRequest<{summary:MatchSummaryData}>(`match-summary?matchId=${encodeURIComponent(matchId)}`);setSummary(d.summary);},[matchId]);useEffect(()=>{void loadSummary();},[loadSummary]);useEffect(()=>{if(location.hash==='#data-quality')setShowQuality(true);},[location.hash]);if(!program||!matchId)return null;return <AppShell program={program}><Link className="back-link" to="/matches">← All Matches</Link>{summary?<MatchSummary summary={summary}/>:<div className="empty-panel">Loading match summary…</div>}<div className="secondary-match-tools"><button className="secondary-button" onClick={()=>setShowQuality(v=>!v)}>Data Quality & Match Timeline</button><span className="muted">Deep PBP inspection and corrections</span></div>{showQuality?<MatchDataQuality matchId={matchId} canCorrectData={program.canCorrectData} onSummaryRefresh={loadSummary}/>:null}</AppShell>}
