import { recalculateMatch } from '../../db/repositories/analytics.js';
import { getMatchDataQuality, removeRallyOverride, setRallyOverride } from '../../db/repositories/data-quality.js';
import { validateMatchCorrection, validateUndoCorrection } from '../ingestion/reconciliation/corrections.js';

export { validateMatchCorrection } from '../ingestion/reconciliation/corrections.js';

export async function applyMatchCorrection(input:{programId:string;matchId:string;setNumber:number;rallyNumber:number;fieldName:string;value:unknown;reason?:string|null;actorEmail:string;canCorrectData:boolean}){
  const valid=validateMatchCorrection(input);
  const correction=await setRallyOverride({...input,...valid});
  const analytics=await recalculateMatch(input.matchId);
  return {correction,analytics,dataQuality:await getMatchDataQuality(input.programId,input.matchId)};
}

export async function undoMatchCorrection(input:{programId:string;matchId:string;setNumber:number;rallyNumber:number;fieldName:string;reason?:string|null;actorEmail:string;canCorrectData:boolean}){
  const valid=validateUndoCorrection(input);
  const correction=await removeRallyOverride({...input,...valid});
  const analytics=await recalculateMatch(input.matchId);
  return {correction,analytics,dataQuality:await getMatchDataQuality(input.programId,input.matchId)};
}
