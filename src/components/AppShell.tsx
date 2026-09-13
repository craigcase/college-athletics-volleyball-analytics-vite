import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { ProgramContext } from '../lib/types';

const nav=[
  ['Matches','/matches',true],['Rotations','#',false],['Players','#',false],['Probability','#',false],['Scouting','#',false],["Coach's Edge",'/coaches-edge',true],['Roster','/roster',true],['Schedule','/schedule',true],['Program Settings','/settings',true],
] as const;
export function AppShell({children,program}:{children:ReactNode;program:ProgramContext}){
 const {signOut}=useAuth();
 return <div className="app-frame" style={{'--program-primary':program.primaryColor,'--program-accent':program.accentColor} as CSSProperties}>
  <aside className="sidebar"><Link to="/matches" className="brand-lockup"><div className="brand-mark">{program.schoolAbbreviation.slice(0,4)}</div><div><strong>{program.schoolAbbreviation}</strong><span>{program.teamName}</span></div></Link>
   <nav>{nav.map(([label,href,active])=>active?<NavLink key={label} className={({isActive})=>`nav-link ${isActive?'is-current':''}`} to={href}>{label}</NavLink>:<span key={label} className="nav-link is-disabled" title="Foundation ready; module comes later">{label}<small>Later</small></span>)}</nav>
   <div className="sidebar-foot"><span>College Athletics Consulting</span><strong>FAST · EASY · EFFICIENT</strong></div>
  </aside>
  <div className="main-column"><header className="topbar"><div><span className="eyebrow">Volleyball Analytics</span><strong>{program.schoolAbbreviation} {program.teamName}</strong></div><div className="topbar-actions"><div className="season-pill">Season <b>{program.seasonYear}</b></div><button className="sign-out-button" onClick={()=>void signOut()}>Sign out</button></div></header><main className="content">{children}</main></div>
 </div>;
}
