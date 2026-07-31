import { Outlet, NavLink } from 'react-router';
import SessionBar from './SessionBar';

export default function Layout() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span>🏗️</span>
          <span>Apex OS</span>
        </div>
        <div className="header-subtitle">Designer Pools — Lubbock, TX</div>
      </header>
      
      <nav className="nav">
        <NavLink to="/today" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Today
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Projects
        </NavLink>
        <NavLink to="/brief" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Brief
        </NavLink>
      </nav>
      
      <main className="main">
        <SessionBar />
        <Outlet />
      </main>
    </div>
  );
}