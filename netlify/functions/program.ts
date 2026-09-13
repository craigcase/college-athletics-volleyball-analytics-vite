import { createProgram, getActiveProgramForUser, updateProgramIdentity } from '../../db/repositories/programs.js';
import { validateProgramIdentityUpdate, validateProgramSetup } from '../../lib/program/validation.js';
import { requireCurrentUser } from './_shared/auth.js';
import { json, message, statusFor } from './_shared/http.js';

export default async (request:Request)=>{
  try{
    const user=await requireCurrentUser(request);
    if(request.method==='GET')return json({program:await getActiveProgramForUser(user)});
    if(request.method==='PATCH'){
      const body=await request.json().catch(()=>null);
      const validated=validateProgramIdentityUpdate(body);
      if(validated.ok===false)return json({error:'Program identity is incomplete.',details:validated.errors},400);
      try{return json({program:await updateProgramIdentity(validated.value,user)});}catch(e){
        if(e instanceof Error&&e.message==='PROGRAM_NOT_FOUND')return json({error:'Program not found.'},404);
        if(e instanceof Error&&e.message==='PROGRAM_SETTINGS_FORBIDDEN')return json({error:'Only the program owner can edit program identity.'},403);
        throw e;
      }
    }
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    const body=await request.json().catch(()=>null);
    const validated=validateProgramSetup(body);
    if(validated.ok===false)return json({error:'Program identity is incomplete.',details:validated.errors},400);
    try{return json({program:await createProgram(validated.value,user)},201)}catch(e){
      if(e instanceof Error&&e.message==='ACTIVE_PROGRAM_EXISTS')return json({error:'This account already has an active program.'},409);
      throw e;
    }
  }catch(e){
    const m=message(e,'Program request failed.');
    return json({error:m},statusFor(m));
  }
}
