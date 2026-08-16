import { Routes, Route, Navigate } from 'react-router';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Calendar from './pages/Calendar';
import TodayFeed from './pages/TodayFeed';
import Projects from './pages/Projects';
import HistoricalProjects from './pages/HistoricalProjects';
import ProjectDetail from './pages/ProjectDetail';
import OwnerBrief from './pages/OwnerBrief';
import CustomerPage from './pages/CustomerPage';
import AuthCallback from './pages/AuthCallback';
import OpportunityEstimate from './pages/OpportunityEstimate';
import ProposalPreview from './pages/ProposalPreview';

const DesignerApp = lazy(async () => {
  const module = await import('@apex/designer');
  return { default: module.App };
});

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
      {/* Outside the shell: the shell renders sign-in whenever the API is
          refusing, and during the callback it is — there is no token yet. */}
      <Route path="callback" element={<AuthCallback />} />
      <Route path="designer" element={
        <Suspense fallback={<main className="designer-loading" aria-live="polite">Opening Designer…</main>}>
          <DesignerApp />
        </Suspense>
      } />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayFeed />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="projects" element={<Projects />} />
        <Route path="historical" element={<HistoricalProjects />} />
        <Route path="historical/:id" element={<ProjectDetail historical />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/customer" element={<CustomerPage />} />
        <Route path="brief" element={<OwnerBrief />} />
        <Route path="opportunities/:leadId/estimate" element={<OpportunityEstimate />} />
        <Route path="proposals/:proposalVersionId" element={<ProposalPreview />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
