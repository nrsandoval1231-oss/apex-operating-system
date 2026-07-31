import { Link } from 'react-router';
import { mockActionCards, mockProjects } from '../data/mockData';

export default function OwnerBrief() {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const urgentActions = mockActionCards.filter(c => c.type === 'urgent');
  const readyToBill = mockActionCards.filter(c => c.type === 'success');
  const atRiskProjects = mockProjects.filter(p => p.status === 'at-risk' || p.status === 'blocked');

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">Daily Brief</h1>
          <p className="text-muted" style={{ fontSize: '14px' }}>{today}</p>
        </div>
      </div>

      <p className="notice warning" role="note">
        <strong>Sample data.</strong> Every figure below is illustrative. The real brief is
        generated from action cards and is not built yet.
      </p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--danger)' }}>{urgentActions.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Urgent Actions</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--warning)' }}>{atRiskProjects.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>At Risk</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)' }}>{readyToBill.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ready to Bill</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--info)' }}>{mockProjects.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Projects</div>
        </div>
      </div>

      {/* Urgent actions */}
      {urgentActions.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '24px 0 12px', color: 'var(--danger)' }}>
            🚨 Needs Your Attention
          </h2>
          {urgentActions.map(card => (
            <div key={card.id} className="action-card urgent" style={{ marginBottom: '8px' }}>
              <div className="action-project">{card.projectName}</div>
              <div className="action-description">{card.title}</div>
              <Link to={`/projects/${card.projectId}`} className="action-button" style={{ fontSize: '13px', padding: '8px 16px' }}>
                Take Action
              </Link>
            </div>
          ))}
        </>
      )}

      {/* At risk projects */}
      {atRiskProjects.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '24px 0 12px', color: 'var(--warning)' }}>
            ⚠️ Projects at Risk
          </h2>
          {atRiskProjects.map(project => (
            <div key={project.id} className="card" style={{ marginBottom: '8px' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{project.name}</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>{project.nextAction}</div>
                </div>
                <Link to={`/projects/${project.id}`} className="action-button secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                  View
                </Link>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Ready to bill */}
      {readyToBill.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '24px 0 12px', color: 'var(--success)' }}>
            💰 Ready to Bill
          </h2>
          {readyToBill.map(card => (
            <div key={card.id} className="action-card success" style={{ marginBottom: '8px' }}>
              <div className="action-project">{card.projectName}</div>
              <div className="action-description">{card.description}</div>
              <button className="action-button" style={{ fontSize: '13px', padding: '8px 16px', background: 'var(--success)' }}>
                Create Invoice
              </button>
            </div>
          ))}
        </>
      )}

      {/* This week */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '24px 0 12px' }}>
        📅 This Week
      </h2>
      <div className="card">
        <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 500 }}>Gunite — Smith Residence</div>
            <div className="text-muted" style={{ fontSize: '12px' }}>Tomorrow, 7:00 AM</div>
          </div>
          <span className="card-badge badge-warning">Crew scheduled</span>
        </div>
        <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 500 }}>City Inspection — Johnson Pool</div>
            <div className="text-muted" style={{ fontSize: '12px' }}>Thursday, 10:00 AM</div>
          </div>
          <span className="card-badge badge-info">Requested</span>
        </div>
        <div className="flex items-center justify-between" style={{ padding: '8px 0' }}>
          <div>
            <div style={{ fontWeight: 500 }}>Deck Crew — Davis Pool</div>
            <div className="text-muted" style={{ fontSize: '12px' }}>Friday, 8:00 AM</div>
          </div>
          <span className="card-badge badge-info">Confirmed</span>
        </div>
      </div>
    </div>
  );
}