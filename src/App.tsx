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

function ProtectedApp(){const{user,loading}=useAuth();if(loading)return <Loading label="Checking session…"/>;if(!user)return <Navigate to="/login" replace/>;return <ProgramProvider><ProgramRoutes/></ProgramProvider>}
function ProgramRoutes(){const{program,loading}=useProgram();if(loading)return <Loading label="Loading program…"/>;return <Routes><Route path="/" element={<Navigate to={program?'/matches':'/setup'} replace/>}/><Route path="/setup" element={<SetupPage/>}/>{program&&<><Route path="/roster" element={<RosterPage/>}/><Route path="/schedule" element={<SchedulePage/>}/><Route path="/matches" element={<MatchesPage/>}/><Route path="/matches/:matchId" element={<MatchPage/>}/><Route path="/coaches-edge" element={<CoachesEdgePage/>}/></>}<Route path="*" element={<Navigate to={program?'/matches':'/setup'} replace/>}/></Routes>}
export function App(){const{loading}=useAuth();if(loading)return <Loading/>;return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/*" element={<ProtectedApp/>}/></Routes>}
