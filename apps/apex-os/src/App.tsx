import { Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import TodayFeed from './pages/TodayFeed';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import CustomerView from './pages/CustomerView';
import OwnerBrief from './pages/OwnerBrief';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayFeed />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="brief" element={<OwnerBrief />} />
      </Route>
      <Route path="/customer/:projectId" element={<CustomerView />} />
    </Routes>
  );
}