import { Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import TodayFeed from './pages/TodayFeed';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import OwnerBrief from './pages/OwnerBrief';

/**
 * Only wired screens are routed.
 *
 * The customer progress page is not built yet and its sample-data prototype is
 * not reachable — a screen of invented pools inside a system built for
 * trustworthy field evidence is the one bug worth being absolute about.
 * `src/pages/CustomerView.tsx` remains in the tree as reference for Step 7.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayFeed />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="brief" element={<OwnerBrief />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
