import { reviewMatchImport, type MatchImportReviewAction } from '../../lib/services/review-match-import.js';
import { requireProgramContext } from './_shared/auth.js';
import { json, message, statusFor } from './_shared/http.js';

const allowed=new Set<MatchImportReviewAction>(['confirm','choose_existing','create_missing']);
export default async(request:Request)=>{try{
  const{user,program}=await requireProgramContext(request);
  const body=await request.json() as Record<string,unknown>;
  const action=String(body.action??'') as MatchImportReviewAction;
  if(!allowed.has(action))return json({error:'Choose a valid match review action.'},400);
  if(typeof body.sourceArtifactId!=='string')return json({error:'Source artifact is required.'},400);
  const result=await reviewMatchImport({programId:program.programId,seasonId:program.seasonId,ourTeamId:program.teamId,sourceArtifactId:body.sourceArtifactId,action,matchId:typeof body.matchId==='string'?body.matchId:undefined,actorEmail:user.email,ourTeamNames:[program.schoolAbbreviation,program.teamName,...(program.schoolName?[program.schoolName]:[])],canCorrectData:program.canCorrectData});
  return json({result});
}catch(e){const m=message(e,'Match review failed.');return json({error:m},statusFor(m));}};
