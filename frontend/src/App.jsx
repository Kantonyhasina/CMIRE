import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import { ROLES } from './roles.js';
import Login from './pages/Login.jsx';
import Accueil from './pages/Accueil.jsx';
import Comptes from './pages/Comptes.jsx';
import Referentiels from './pages/Referentiels.jsx';
import Disponibilites from './pages/Disponibilites.jsx';
import Permanences from './pages/Permanences.jsx';
import MonPlanning from './pages/MonPlanning.jsx';
import Missions from './pages/Missions.jsx';
import MesConges from './pages/MesConges.jsx';
import DemandesConges from './pages/DemandesConges.jsx';
import CalendrierConges from './pages/CalendrierConges.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Accueil />} />
        <Route
  path="permanences"
  element={
    <RequireAuth roles={[ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT]}>
      <Permanences />
    </RequireAuth>
  }
/>
        <Route
          path="mon-planning"
          element={<RequireAuth roles={[ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT]}><MonPlanning /></RequireAuth>}
        />
        <Route
          path="missions"
          element={<RequireAuth roles={[ROLES.CHEF, ROLES.CADRE]}><Missions /></RequireAuth>}
        />
        <Route
          path="mes-conges"
          element={<RequireAuth roles={[ROLES.CADRE, ROLES.SURVEILLANT]}><MesConges /></RequireAuth>}
        />
        <Route
          path="demandes-conges"
          element={<RequireAuth roles={[ROLES.CHEF]}><DemandesConges /></RequireAuth>}
        />
        <Route
          path="calendrier-conges"
          element={<RequireAuth roles={[ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT]}><CalendrierConges /></RequireAuth>}
        />
        <Route
          path="disponibilites"
          element={<RequireAuth roles={[ROLES.CHEF]}><Disponibilites /></RequireAuth>}
        />
        <Route path="comptes" element={<RequireAuth roles={[ROLES.ADMIN]}><Comptes /></RequireAuth>} />
        <Route path="comptes/desactives" element={<RequireAuth roles={[ROLES.ADMIN]}><Comptes afficherDesactives /></RequireAuth>} />
        <Route path="referentiels" element={<RequireAuth roles={[ROLES.ADMIN]}><Referentiels /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
