export const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});
export const message=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback;
export const statusFor=(m:string)=>m==='UNAUTHENTICATED'?401:m==='DATA_CORRECTION_FORBIDDEN'?403:m==='PROGRAM_SETUP_REQUIRED'?409:400;
