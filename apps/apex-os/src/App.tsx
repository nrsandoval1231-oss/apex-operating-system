import { Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import TodayFeed from './pages/TodayFeed';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';

/**
 * Only wired screens are routed.
 *
 * The owner brief and the customer progress page are not built yet, and their
 * sample-data prototypes are no longer reachable — a screen of invented pools
 * inside a system built for trustworthy field evidence is the one bug worth
 * being absolute about. `src/pages/OwnerBrief.tsx` and `src/pages/CustomerView.tsx`
 * remain in the tree as reference for build-plan Steps 7 and 8.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayFeed />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
