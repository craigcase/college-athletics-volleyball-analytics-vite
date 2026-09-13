import { useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { apiRequest } from '../lib/api';
import { useProgram } from '../lib/program';
import type { ProgramContext } from '../lib/types';

export function ProgramSettingsPage(){
 const{program,refresh}=useProgram();const[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 if(!program)return null;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const fd=new FormData(e.currentTarget);
   await apiRequest<{program:ProgramContext}>('program',{
    method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({
     schoolName:fd.get('schoolName'),schoolAbbreviation:fd.get('schoolAbbreviation'),teamName:fd.get('teamName'),
     primaryColor:fd.get('primaryColor'),secondaryColor:fd.get('secondaryColor'),accentColor:fd.get('accentColor')
    })
   });
   await refresh();setMessage('Program identity saved.');
  }catch(err){setError(err instanceof Error?err.message:'Program settings could not be saved.');}finally{setBusy(false);}
 }
 return <AppShell program={program}><div className="page-head"><div><span className="eyebrow">Program Settings</span><h1>Program identity</h1><p>Keep the full university name on file, while the primary app identity stays focused on your abbreviation, mascot, and school colors.</p></div></div><section className="panel settings-panel"><form className="setup-form" onSubmit={submit}><label>Full university name<input name="schoolName" defaultValue={program.schoolName??''} placeholder="Valley City State University" maxLength={160} required/></label><div className="settings-emphasis"><div><span className="eyebrow">Primary app identity</span><p>These are the branding fields coaches will see most often throughout the app.</p></div><div className="field-grid two"><label>School abbreviation<input className="caps-input" name="schoolAbbreviation" defaultValue={program.schoolAbbreviation} maxLength={12} required/></label><label>Mascot / team name<input className="caps-input" name="teamName" defaultValue={program.teamName} maxLength={80} required/></label></div><div className="field-grid three"><label>Primary color<input name="primaryColor" type="color" defaultValue={program.primaryColor}/></label><label>Secondary color<input name="secondaryColor" type="color" defaultValue={program.secondaryColor}/></label><label>Accent color<input name="accentColor" type="color" defaultValue={program.accentColor}/></label></div></div>{error&&<p className="form-error">{error}</p>}{message&&<p className="form-success">{message}</p>}<div className="settings-actions"><button className="primary-button" disabled={busy||program.role!=='owner'}>{busy?'Saving…':'Save Program Identity'}</button>{program.role!=='owner'&&<span className="muted">Only the program owner can edit identity settings.</span>}</div></form></section></AppShell>
}
