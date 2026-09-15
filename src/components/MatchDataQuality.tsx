import { useEffect, useMemo, useState } from 'react';
import { apiJson, apiRequest } from '../lib/api';
import type { MatchDataQualityData, DataQualityRally } from '../lib/types';

const terminalOptions=[['kill','Kill'],['attack_error','Attack error'],['service_ace','Service ace'],['service_error','Service error'],['stuff_block','Stuff block'],['setting_error','Setting error'],['ball_handling_error','Ball handling error'],['blocking_error','Blocking error'],['penalty_point','Penalty point'],['unknown','Unknown']] as const;
const reasonOptions=[['','Optional reason'],['reviewed_film','Reviewed film'],['official_stats','Confirmed with official stats'],['scorekeeper_correction','Scorekeeper correction'],['roster_player_correction','Known roster/player correction'],['other','Other']] as const;
const label=(value:string|undefined)=>value?value.replaceAll('_',' '):'Unknown';

function RallyRow({rally,matchId,canCorrectData,activeOverrideFields,onChanged}:{rally:DataQualityRally;matchId:string;canCorrectData:boolean;activeOverrideFields:string[];onChanged:(data:MatchDataQualityData)=>void}){
  const[open,setOpen]=useState(false),[correcting,setCorrecting]=useState(false),[terminal,setTerminal]=useState(rally.terminal?.type??'unknown'),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const openIssues=rally.issues.filter(issue=>issue.status==='open');
  async function submitCorrection(){setBusy(true);setError('');try{const d=await apiJson<{result:{dataQuality:MatchDataQualityData}}>('match-data-correction',{action:'apply',matchId,setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,fieldName:'terminal_event_type',value:terminal,reason:reason||null});onChanged(d.result.dataQuality);setCorrecting(false);}catch(e){setError(e instanceof Error?e.message:'Correction failed.');}finally{setBusy(false);}}
  async function undo(fieldName:string){setBusy(true);setError('');try{const d=await apiJson<{result:{dataQuality:MatchDataQualityData}}>('match-data-correction',{action:'undo',matchId,setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,fieldName,reason:reason||null});onChanged(d.result.dataQuality);}catch(e){setError(e instanceof Error?e.message:'Undo failed.');}finally{setBusy(false);}}
  return <article className={`quality-rally-row ${openIssues.length?'has-issue':''}`}>
    <button className="quality-rally-summary" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <span className="rally-set">S{rally.setNumber}</span><strong>{rally.scoreAfter.our}-{rally.scoreAfter.opponent}</strong><span>{rally.terminal?.type?label(rally.terminal.type):'Terminal detail unknown'}{rally.terminal?.playerSourceKey?` — ${rally.terminal.playerSourceKey}`:''}</span><span className="rally-spacer"/>{openIssues.length?<span className="issue-pill">Data Issue</span>:null}<span className="evidence-pill">{label(rally.evidenceStatus)}</span><span>{open?'▴':'▾'}</span>
    </button>
    {open?<div className="quality-rally-detail">
      <div className="evidence-columns"><div><h4>Current canonical fact</h4><p>Winner: {label(rally.pointWinner)}</p><p>Serve: {label(rally.servingSide)}</p><p>Pathway: {label(rally.pathway)}</p><p>Attribution: {label(rally.attribution)}</p></div><div><h4>Imported source evidence</h4><p>{rally.sourceTerminal?JSON.stringify(rally.sourceTerminal):'No terminal event was explicitly available from the source.'}</p><p className="muted">{rally.sourceLinks.length} source link{rally.sourceLinks.length===1?'':'s'} retained for this point.</p></div></div>
      {openIssues.map(issue=><div className="issue-detail" key={issue.id}><strong>Data Issue</strong><p>{issue.issue_type.replaceAll('_',' ')}</p>{issue.details?.reason?<p>{String(issue.details.reason)}</p>:null}</div>)}
      {canCorrectData?<div className="correction-zone">{!correcting?<button className="secondary-button" onClick={()=>setCorrecting(true)}>Correct Play</button>:<div className="correction-form"><label>Terminal result<select value={terminal} onChange={e=>setTerminal(e.target.value)}>{terminalOptions.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label><label>Optional reason<select value={reason} onChange={e=>setReason(e.target.value)}>{reasonOptions.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label><div className="review-actions"><button disabled={busy} onClick={submitCorrection}>Save correction</button><button className="secondary-button" disabled={busy} onClick={()=>setCorrecting(false)}>Cancel</button></div></div>}{activeOverrideFields.includes('terminal_event_type')?<ActiveUndo matchId={matchId} entityId={rally.entityId} busy={busy} onUndo={undo}/>:null}</div>:null}
      {error?<p className="error-text">{error}</p>:null}
    </div>:null}
  </article>;
}

function ActiveUndo({matchId:_,entityId,busy,onUndo}:{matchId:string;entityId:string;busy:boolean;onUndo:(fieldName:string)=>Promise<void>}){
  // The active override list is rendered at the parent level; this button is kept close to the corrected point.
  return <button className="text-button undo-correction" disabled={busy} data-entity-id={entityId} onClick={()=>onUndo('terminal_event_type')}>Undo correction</button>;
}

export function MatchDataQuality({matchId,canCorrectData,onSummaryRefresh}:{matchId:string;canCorrectData:boolean;onSummaryRefresh:()=>Promise<void>|void}){
  const[data,setData]=useState<MatchDataQualityData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[setFilter,setSetFilter]=useState<number|'all'>('all'),[issuesOnly,setIssuesOnly]=useState(false);
  async function load(){setLoading(true);setError('');try{const d=await apiRequest<{dataQuality:MatchDataQualityData}>(`match-data-quality?matchId=${encodeURIComponent(matchId)}`);setData(d.dataQuality);}catch(e){setError(e instanceof Error?e.message:'Data quality failed to load.');}finally{setLoading(false);}}
  useEffect(()=>{void load();},[matchId]);
  const sets=useMemo(()=>[...new Set((data?.rallies??[]).map(r=>r.setNumber))].sort((a,b)=>a-b),[data]);
  const rows=useMemo(()=>(data?.rallies??[]).filter(r=>(setFilter==='all'||r.setNumber===setFilter)&&(!issuesOnly||r.issues.some(issue=>issue.status==='open'))),[data,setFilter,issuesOnly]);
  async function changed(next:MatchDataQualityData){setData(next);await onSummaryRefresh();}
  if(loading)return <div className="empty-panel">Loading Data Quality…</div>;
  if(error)return <div className="empty-panel"><p>{error}</p><button onClick={()=>void load()}>Retry</button></div>;
  if(!data)return null;
  return <section className="match-data-quality" id="data-quality"><header className="quality-header"><div><span className="eyebrow">Deep inspection</span><h2>Data Quality & Match Timeline</h2><p className="muted">Compact play-by-play by point. Open a point only when you need to inspect evidence or correct a detail.</p></div><div className="quality-count"><strong>{data.issues.open.length}</strong><span>open issues</span></div></header>
    <div className="set-filter" aria-label="Filter play-by-play by set"><button className={setFilter==='all'?'active':''} onClick={()=>setSetFilter('all')}>All Sets</button>{sets.map(setNumber=><button key={setNumber} className={setFilter===setNumber?'active':''} onClick={()=>setSetFilter(setNumber)}>Set {setNumber}</button>)}</div>
    <div className="quality-toolbar"><label><input type="checkbox" checked={issuesOnly} onChange={e=>setIssuesOnly(e.target.checked)}/> Data Issues only</label><span>{rows.length} point{rows.length===1?'':'s'}</span></div>
    <div className="quality-rally-list">{rows.map(rally=><RallyRow key={rally.entityId} rally={rally} matchId={matchId} canCorrectData={canCorrectData} activeOverrideFields={(data.overrides??[]).filter((row:any)=>row.entity_id===rally.entityId).map((row:any)=>String(row.field_name))} onChanged={changed}/>)}</div>
    {!rows.length?<div className="empty-panel">No points match this filter.</div>:null}
    {data.issues.resolved.length?<details className="resolved-history"><summary>Resolved History ({data.issues.resolved.length})</summary>{data.issues.resolved.map(issue=><p key={issue.id}>{issue.issue_type.replaceAll('_',' ')} · {issue.entity_id??'match'}</p>)}</details>:null}
  </section>;
}
