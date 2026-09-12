import { getAdminClient } from '../../../db/client.js';
import { getCurrentUserFromSupabase, type CurrentUser } from '../../../lib/auth/current-user.js';
import { getActiveProgramForUser } from '../../../db/repositories/programs.js';
export async function requireCurrentUser(request:Request):Promise<CurrentUser>{const header=request.headers.get('authorization')||'';const token=header.startsWith('Bearer ')?header.slice(7):'';if(!token)throw new Error('UNAUTHENTICATED');const {data,error}=await getAdminClient().auth.getUser(token);if(error)throw new Error('UNAUTHENTICATED');const user=getCurrentUserFromSupabase(data.user as any);if(!user)throw new Error('UNAUTHENTICATED');return user;}
export async function requireProgramContext(request:Request){const user=await requireCurrentUser(request);const program=await getActiveProgramForUser(user);if(!program)throw new Error('PROGRAM_SETUP_REQUIRED');return{user,program};}
