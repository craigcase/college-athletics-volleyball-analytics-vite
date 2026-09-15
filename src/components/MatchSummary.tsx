import { Link } from 'react-router-dom';
import type { MatchSummaryData, MatchSummaryMetric } from '../lib/types';

const labels:Record<string,string>={
  hitting_percentage:'Hitting %',kills:'Kills',attack_errors:'Attack Errors',attack_attempts:'Attempts',aces:'Aces',service_errors:'Service Errors',
};
const rallyLabels:Record<string,string>={
  sideout_percentage:'Sideout %',
  point_scored_percentage:'Point Scored %',
  score1_percentage:'Score1',
  sos2_percentage:'SOS2',
  epo_percentage:'EPO',
  longest_service_run:'Longest Service Run',
};
const rallyOrder=['sideout_percentage','point_scored_percentage','score1_percentage','sos2_percentage','epo_percentage','longest_service_run'];

function display(metric:string,value:number){
  if(metric==='hitting_percentage')return value.toFixed(3).replace(/^0/,'');
  if(metric.endsWith('_percentage'))return `${(value*100).toFixed(1)}%`;
  return Number.isInteger(value)?String(value):value.toFixed(1);
}

function RallyMetric({metric,subject,rows,schoolAbbreviation}:{metric:string;subject:'our_team'|'opponent';rows:MatchSummaryMetric[];schoolAbbreviation:string}){
  const row=rows.find(item=>item.subject===subject&&item.metric===metric);
  return <div className="rally-metric-side">
    <small>{subject==='our_team'?schoolAbbreviation:'OPP'}</small>
    {row?<><strong>{display(metric,row.value)}</strong>{row.opportunities!=null&&<span>{row.numerator??Math.round(row.value*row.opportunities)} / {row.opportunities} opportunities</span>}</>:<span className="rally-unavailable">Not available from this evidence</span>}
  </div>;
}

function RallyAnalytics({summary,schoolAbbreviation}:{summary:MatchSummaryData;schoolAbbreviation:string}){
  const analytics=summary.rallyAnalytics;
  const bestRun=(side:'our_team'|'opponent')=>analytics.serviceRuns.filter(run=>run.teamSide===side).sort((a,b)=>b.pointsWon-a.pointsWon||b.serveAttempts-a.serveAttempts)[0];
  return <section className="rally-analytics panel">
    <div className="section-head"><div><span className="eyebrow">Deterministic rally state</span><h2>Rally Analytics</h2></div></div>
    {analytics.scoreIntegrity.status==='conflict'&&<div className="unsupported-evidence"><strong>Rally score conflict</strong><span>Source play-by-play conflicts with the official set score in set{analytics.scoreIntegrity.conflictedSets.length===1?'':'s'} {analytics.scoreIntegrity.conflictedSets.join(', ')}. Rally analytics are withheld rather than guessed.</span></div>}
    <div className="rally-metric-grid">
      {rallyOrder.map(metric=><article className="rally-metric-card" key={metric}>
        <h3>{rallyLabels[metric]}</h3>
        {metric==='longest_service_run'?<div className="rally-metric-sides">
          {(['our_team','opponent'] as const).map(side=>{const run=bestRun(side);return <div className="rally-metric-side" key={side}><small>{side==='our_team'?schoolAbbreviation:'OPP'}</small>{run?<><strong>{run.pointsWon}</strong><span>{run.serveAttempts} serve attempts · Set {run.setNumber}</span></>:<span className="rally-unavailable">Not available from this evidence</span>}</div>})}
        </div>:<div className="rally-metric-sides"><RallyMetric metric={metric} subject="our_team" rows={analytics.metrics} schoolAbbreviation={schoolAbbreviation}/><RallyMetric metric={metric} subject="opponent" rows={analytics.metrics} schoolAbbreviation={schoolAbbreviation}/></div>}
      </article>)}
    </div>
    <div className="sideout-pathways">
      <h3>Sideout Pathways</h3>
      <p className="muted">Known pathways stay separate from sideouts whose phase cannot be proven by this source.</p>
      <div className="pathway-grid">{(['our_team','opponent'] as const).map(side=><div key={side}><strong>{side==='our_team'?schoolAbbreviation:'OPP'}</strong><span>First-ball sideout <b>{analytics.sideoutPathways[side].first_ball_sideout}</b></span><span>Regular sideout <b>{analytics.sideoutPathways[side].regular_sideout}</b></span><span>Phase unknown <b>{analytics.sideoutPathways[side].unknown_phase}</b></span></div>)}</div>
    </div>
    {analytics.unsupported.length>0&&<div className="unsupported-evidence"><strong>Not available from this evidence</strong><span>{analytics.unsupported.join(' · ')}</span></div>}
  </section>;
}

export function MatchSummary({summary,schoolAbbreviation}:{summary:MatchSummaryData;schoolAbbreviation:string}){
  const by=(subject:string,metric:string)=>summary.metrics.find(m=>m.subject===subject&&m.metric===metric);
  const ribbon=['hitting_percentage','kills','attack_errors','aces','service_errors'].filter(metric=>by('our_team',metric)||by('opponent',metric));
  const our=summary.findings.filter((f:any)=>f.side==='our_team'),opp=summary.findings.filter((f:any)=>f.side==='opponent');
  return <>
    <section className="match-hero"><div><span className={`data-badge ${String(summary.dataStatus).toLowerCase().replaceAll(' ','-')}`}>{summary.dataStatus}</span><p>{new Date(summary.scheduledAt).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · {summary.homeAway}</p><h1>{summary.result?`${summary.result} · `:''}{summary.opponentName}</h1>{summary.setScoresJson&&<p className="set-score-line">{JSON.parse(summary.setScoresJson).join(' · ')}</p>}</div><Link className="secondary-button link-button" to={`/coaches-edge?matchId=${summary.id}`}>Ask Coach's Edge</Link></section>
    {ribbon.length?<section className="stat-ribbon">{ribbon.map(metric=><div className="stat-cell" key={metric}><span>{labels[metric]||metric}</span><div><strong>{by('our_team',metric)?display(metric,by('our_team',metric)!.value):'—'}</strong><small>{schoolAbbreviation}</small></div><div><strong>{by('opponent',metric)?display(metric,by('opponent',metric)!.value):'—'}</strong><small>OPP</small></div></div>)}</section>:<section className="empty-panel"><h3>No supported match metrics yet</h3><p>Add a public box score or structured match file. Missing evidence stays missing.</p></section>}
    <RallyAnalytics summary={summary} schoolAbbreviation={schoolAbbreviation}/>
    <div className="impact-grid"><Impact title="Our Match Impact" rows={our} schoolAbbreviation={schoolAbbreviation}/><Impact title="Opponent Match Impact" rows={opp} schoolAbbreviation={schoolAbbreviation}/></div>
    <details className="data-details"><summary>Data details</summary><div>{summary.sources.length?summary.sources.map((s:any,i:number)=><p key={i}><b>{s.sourceFamily}</b> {s.fileName||s.sourceUrl||''} <span>{new Date(s.importedAt).toLocaleString()}</span></p>):<p>No match evidence attached.</p>}</div></details>
  </>;
}

function Impact({title,rows,schoolAbbreviation}:{title:string;rows:any[];schoolAbbreviation:string}){
  return <section className="impact-panel"><span className="eyebrow">Deterministic findings</span><h2>{title}</h2>{rows.length?rows.map((f,i)=>{const e=JSON.parse(f.evidenceJson);return <article className="finding" key={i}><b>{labels[f.metric]||f.metric}</b><p>{f.direction==='our_advantage'?'We':'Opponent'} separated by {f.metric==='hitting_percentage'?f.magnitude.toFixed(3):f.magnitude.toFixed(1)} in this match.</p><small>{schoolAbbreviation} {display(f.metric,e.ourValue)} · OPP {display(f.metric,e.opponentValue)}{f.opportunities?` · ${f.opportunities} opportunities`:''}</small></article>}):<p className="muted">No finding clears the evidence threshold. We do not fill space with weak conclusions.</p>}</section>;
}
