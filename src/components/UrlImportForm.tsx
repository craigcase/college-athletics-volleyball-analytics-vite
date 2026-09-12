import { useState, type FormEvent } from 'react';
import { apiJson } from '../lib/api';
export function UrlImportForm({kind,fn,placeholder,buttonLabel,onComplete}:{kind:string;fn:string;placeholder:string;buttonLabel:string;onComplete:()=>Promise<void>|void}){
 const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');try{const sourceUrl=String(new FormData(e.currentTarget).get('sourceUrl')||'');const d=await apiJson<any>(fn,{sourceUrl});const s=d.summary;setMessage(s?`${s.total} processed • ${s.added??s.created??0} added • ${s.changed??s.updated??0} updated${s.needsReview?` • ${s.needsReview} need review`:''}`:'Import complete.');await onComplete();}catch(error){setMessage(error instanceof Error?error.message:`${kind} import failed.`);}finally{setBusy(false);}}
 return <form className="inline-import" onSubmit={submit}><input name="sourceUrl" type="url" placeholder={placeholder} required/><button className="primary-button" disabled={busy}>{busy?`Reading ${kind.toLowerCase()}…`:buttonLabel}</button>{message&&<p className="import-message">{message}</p>}</form>;
}
