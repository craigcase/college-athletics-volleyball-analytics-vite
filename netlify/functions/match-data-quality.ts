import { getMatchDataQuality } from '../../db/repositories/data-quality.js';
import { requireProgramContext } from './_shared/auth.js';
import { json,message,statusFor } from './_shared/http.js';
export default async(request:Request)=>{try{const{program}=await requireProgramContext(request);const matchId=new URL(request.url).searchParams.get('matchId')||'';if(!matchId)return json({error:'Match id is required.'},400);return json({dataQuality:await getMatchDataQuality(program.programId,matchId)});}catch(e){const m=message(e,'Data quality read failed.');return json({error:m},statusFor(m));}};
