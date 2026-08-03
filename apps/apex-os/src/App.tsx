import { Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import TodayFeed from './pages/TodayFeed';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import OwnerBrief from './pages/OwnerBrief';
import CustomerPage from './pages/CustomerPage';

/**
 * Only wired screens are routed.
 *
 * `projects/:id/customer` is the staff side of the customer progress page —
 * link, photos, and decisions. The page the customer actually opens is not in
 * this bundle at all: it is server-rendered by the Gate API at `/c/<token>`, so
 * a homeowner never receives the staff app. See apps/gate-api/src/customerPage.ts.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayFeed />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/customer" element={<CustomerPage />} />
        <Route path="brief" element={<OwnerBrief />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
