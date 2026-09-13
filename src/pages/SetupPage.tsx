import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useProgram } from '../lib/program';

export function SetupPage(){
 const{program,refresh}=useProgram();const nav=useNavigate();const[error,setError]=useState(''),[busy,setBusy]=useState(false);
 if(program)return <Navigate to="/matches" replace/>;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  try{
   const fd=new FormData(e.currentTarget);
   await apiJson('program',{
    schoolName:fd.get('schoolName'),schoolAbbreviation:fd.get('schoolAbbreviation'),teamName:fd.get('teamName'),
    primaryColor:fd.get('primaryColor'),secondaryColor:fd.get('secondaryColor'),accentColor:fd.get('accentColor'),seasonYear:Number(fd.get('seasonYear'))
   });
   await refresh();nav('/roster');
  }catch(err){setError(err instanceof Error?err.message:'Program setup failed.');}finally{setBusy(false);}
 }
 return <main className="setup-page"><section className="setup-copy"><span className="eyebrow">College Athletics Consulting</span><h1>Build your volleyball intelligence foundation.</h1><p>Set the program identity once. Next, connect the official roster and schedule. Match evidence can be added whenever you have it.</p><div className="principles"><b>FAST.</b><b>EASY.</b><b>EFFICIENT.</b></div></section><section className="setup-card"><div className="step-kicker">Step 1 of 3 · Program Identity</div><form className="setup-form" onSubmit={submit}><label>Full university name<input name="schoolName" placeholder="Valley City State University" maxLength={160} required/></label><div className="field-grid two"><label>School abbreviation<input className="caps-input" name="schoolAbbreviation" placeholder="VCSU" maxLength={12} required/></label><label>Mascot / team name<input className="caps-input" name="teamName" placeholder="VIKINGS" maxLength={80} required/></label></div><div className="field-grid three"><label>Primary color<input name="primaryColor" type="color" defaultValue="#183153"/></label><label>Secondary color<input name="secondaryColor" type="color" defaultValue="#ffffff"/></label><label>Accent color<input name="accentColor" type="color" defaultValue="#b49a63"/></label></div><label>Season year<input name="seasonYear" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required/></label>{error&&<p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Creating program…':'Create Program →'}</button></form></section></main>
}
