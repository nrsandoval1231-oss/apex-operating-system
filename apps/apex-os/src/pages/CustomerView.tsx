import { useParams } from 'react-router';
import { mockProjects, customerMilestones, phases } from '../data/mockData';

export default function CustomerView() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = mockProjects.find(p => p.id === projectId);

  if (!project) {
    return (
      <div className="app">
        <div className="empty-state" style={{ marginTop: '100px' }}>
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">Project not found</div>
          <div className="empty-state-subtext">This link may have expired or is invalid.</div>
        </div>
      </div>
    );
  }

  // Determine which milestones are complete based on project phase
  const getMilestoneStatus = (milestoneId: string) => {
    const phaseOrder = ['Design', 'Excavation', 'Shell', 'Finishes', 'Water', 'Handover'];
    const currentPhaseIndex = phases.indexOf(project.currentPhase);
    const milestoneIndex = phaseOrder.indexOf(milestoneId);
    
    if (milestoneIndex < currentPhaseIndex / 2.5) return 'completed';
    if (Math.abs(milestoneIndex - currentPhaseIndex / 2.5) < 1) return 'current';
    return 'pending';
  };

  return (
    <div className="app">
      <p className="notice warning" role="note">
        <strong>Sample data — internal preview.</strong> This page is not customer-safe yet: it has
        no secure link, no access log, and no approved-photo gate. Do not share it.
      </p>

      {/* Customer header */}
      <div className="customer-header">
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🏊</div>
        <h1 className="customer-title">Your Pool Project</h1>
        <p className="customer-subtitle">{project.name}</p>
        <p className="customer-subtitle">{project.location}</p>
      </div>

      <main className="main">
        {/* Current status */}
        <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>
            {project.status === 'on-track' ? '✅' : project.status === 'at-risk' ? '⚠️' : '🛑'}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            {project.currentPhase}
          </h2>
          <p className="text-muted">
            {project.status === 'on-track' 
              ? 'Your project is progressing on schedule.' 
              : project.status === 'at-risk'
              ? 'We\'re working to keep your project on track.'
              : 'There\'s a delay we\'re actively resolving.'}
          </p>
          <div className="progress-bar" style={{ marginTop: '16px' }}>
            <div 
              className="progress-fill" 
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {project.progress}% complete
          </p>
        </div>

        {/* Milestones */}
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '24px 0 16px' }}>Project Milestones</h2>
        <div className="milestone-grid">
          {customerMilestones.map(milestone => {
            const status = getMilestoneStatus(milestone.id);
            return (
              <div 
                key={milestone.id}
                className={`milestone-item ${status}`}
              >
                <div className="milestone-icon">{milestone.icon}</div>
                <div className="milestone-label">{milestone.label}</div>
              </div>
            );
          })}
        </div>

        {/* What's happening now */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>What's Happening Now</h3>
          <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
            {project.currentPhase === 'Steel & Underground' && 
              'Our crew is installing the steel reinforcement and underground plumbing. This is a critical phase that ensures your pool\'s structural integrity. We\'ll be scheduling an inspection soon.'}
            {project.currentPhase === 'Tile & Coping' && 
              'We\'re selecting and installing the tile and coping for your pool. This is where your design choices really start to show. We\'ll need your final selections soon.'}
            {project.currentPhase === 'Shell Curing' && 
              'The gunite shell has been applied and is now curing. This process takes about 7 days. We\'re monitoring the curing process daily to ensure proper strength.'}
            {!['Steel & Underground', 'Tile & Coping', 'Shell Curing'].includes(project.currentPhase) &&
              `We're currently in the ${project.currentPhase} phase. Our team is working diligently to keep your project moving forward.`}
          </p>
        </div>

        {/* What's next */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>What's Next</h3>
          <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
            Next up: <strong>{project.nextAction}</strong>. We'll keep you updated as we progress.
          </p>
        </div>

        {/* Recent photos */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Recent Photos</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '8px',
            background: 'var(--bg)',
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <div style={{ padding: '24px', background: '#ddd', borderRadius: '8px' }}>📷</div>
            <div style={{ padding: '24px', background: '#ddd', borderRadius: '8px' }}>📷</div>
            <div style={{ padding: '24px', background: '#ddd', borderRadius: '8px' }}>📷</div>
            <p style={{ gridColumn: '1 / -1', fontSize: '12px', marginTop: '8px' }}>
              Photos will appear here as they're approved
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #1B1C1E 0%, #2a2b2d 100%)', color: 'white' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Questions?</h3>
          <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '16px' }}>
            Call or text us anytime. We're here to help.
          </p>
          <div className="flex gap-2">
            <a href="tel:+18065551234" className="action-button" style={{ background: 'var(--accent)', flex: 1, textAlign: 'center' }}>
              📞 Call
            </a>
            <a href="sms:+18065551234" className="action-button" style={{ background: 'var(--accent)', flex: 1, textAlign: 'center' }}>
              💬 Text
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <p>Apex Designer Pools — Lubbock, Texas</p>
          <p style={{ marginTop: '4px' }}>Powered by Apex OS</p>
        </div>
      </main>
    </div>
  );
}