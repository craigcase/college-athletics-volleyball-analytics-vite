import { useState } from 'react';
import type { MatchImportReviewData, MatchReviewCandidate } from '../lib/types';

type ReviewAction='confirm'|'choose_existing'|'create_missing';
const facts=(candidate:MatchReviewCandidate|undefined)=>candidate?[candidate.date,candidate.homeAway,candidate.result,candidate.setScores?.join(', ')].filter(Boolean).join(' • '):'No safe scheduled match was identified.';

export function MatchImportReview({review,busy,onResolve}:{review:MatchImportReviewData;busy:boolean;onResolve:(action:ReviewAction,matchId?:string)=>Promise<void>}){
  const[choosing,setChoosing]=useState(!review.suggested),[selected,setSelected]=useState(review.suggested?.matchId??review.candidates[0]?.matchId??'');
  const imported=review.imported;
  return <section className="match-import-review" aria-label="Match Import Review">
    <div className="review-heading"><span className="eyebrow">Match Import Review</span><h3>Confirm where this evidence belongs</h3><p className="muted">The source is preserved, but the import will not finish until the match identity is confirmed.</p></div>
    <div className="review-compare">
      <article><strong>Imported source</strong><h4>{imported.opponentName??'Opponent not identified'}</h4><p>{[imported.date,imported.homeAway,imported.result].filter(Boolean).join(' • ')||'Limited identity evidence'}</p>{imported.setScores?.length?<p>Sets: {imported.setScores.join(', ')}</p>:null}</article>
      <article><strong>Likely scheduled match</strong><h4>{review.suggested?.canonicalOpponentName??'Needs your selection'}</h4><p>{facts(review.suggested)}</p>{review.suggested?<p className="review-evidence">Matched on: {review.suggested.matchedEvidence.join(', ')||'partial evidence'} • confidence {Math.round(review.suggested.confidence*100)}%</p>:null}</article>
    </div>
    {review.suggested&&!choosing?<div className="review-actions"><button className="primary-button" disabled={busy} onClick={()=>onResolve('confirm',review.suggested?.matchId)}>Confirm Match</button><button className="secondary-button" disabled={busy} onClick={()=>setChoosing(true)}>Choose Another Match</button></div>:null}
    {choosing?<div className="review-chooser"><label>Choose Another Match<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select a scheduled match…</option>{review.candidates.map(candidate=><option key={candidate.matchId} value={candidate.matchId}>{candidate.date??'Date unknown'} — {candidate.canonicalOpponentName} ({Math.round(candidate.confidence*100)}%)</option>)}</select></label><div className="review-actions"><button className="primary-button" disabled={busy||!selected} onClick={()=>onResolve('choose_existing',selected)}>Use Selected Match</button>{review.suggested?<button className="secondary-button" disabled={busy} onClick={()=>setChoosing(false)}>Back</button>:null}</div></div>:null}
    <button className="text-button danger-soft" disabled={busy} onClick={()=>onResolve('create_missing')}>This Match Is Missing From the Schedule</button>
  </section>;
}
