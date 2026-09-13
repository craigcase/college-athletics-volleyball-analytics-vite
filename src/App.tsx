import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ProgramProvider, useProgram } from './lib/program';
import { Loading } from './components/Loading';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { RosterPage } from './pages/RosterPage';
import { SchedulePage } from './pages/SchedulePage';
import { MatchesPage } from './pages/MatchesPage';
import { MatchPage } from './pages/MatchPage';
import { CoachesEdgePage } from './pages/CoachesEdgePage';
import { ProgramSettingsPage } from './pages/ProgramSettingsPage';

function ProtectedApp(){const{user,loading}=useAuth();if(loading)return <Loading label="Checking session…"/>;if(!user)return <Navigate to="/login" replace/>;return <ProgramProvider><ProgramRoutes/></ProgramProvider>}
function ProgramLoadError({message,onRetry}:{message:string;onRetry:()=>Promise<void>}){return <main className="setup-page program-load-error"><section className="setup-card"><span className="eyebrow">Program connection</span><h1>We couldn’t load your program.</h1><p className="muted">{message}</p><p>Your program has not been removed. Retry the connection before creating or changing anything.</p><button className="primary-button" onClick={()=>void onRetry()}>Retry</button></section></main>}
function ProgramRoutes(){const{program,loading,error,refresh}=useProgram();if(loading)return <Loading label="Loading program…"/>;if(error&&!program)return <ProgramLoadError message={error} onRetry={refresh}/>;return <Routes><Route path="/" element={<Navigate to={program?'/matches':'/setup'} replace/>}/><Route path="/setup" element={<SetupPage/>}/>{program&&<><Route path="/roster" element={<RosterPage/>}/><Route path="/schedule" element={<SchedulePage/>}/><Route path="/matches" element={<MatchesPage/>}/><Route path="/matches/:matchId" element={<MatchPage/>}/><Route path="/coaches-edge" element={<CoachesEdgePage/>}/><Route path="/settings" element={<ProgramSettingsPage/>}/></>}<Route path="*" element={<Navigate to={program?'/matches':'/setup'} replace/>}/></Routes>}
export function App(){const{loading}=useAuth();if(loading)return <Loading/>;return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/*" element={<ProtectedApp/>}/></Routes>}
