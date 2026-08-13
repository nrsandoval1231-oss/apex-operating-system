import { Link, useParams } from 'react-router';
import FinishEstimate from '../components/FinishEstimate';

export default function OpportunityEstimate() {
  const { leadId } = useParams<{ leadId: string }>();
  return (
    <>
      <header className="title-block">
        <div><Link className="link-quiet" to="/projects">← Projects</Link><h1>Finish estimate</h1></div>
        <div className="stamp">Opportunity<b>{leadId?.slice(-10) ?? 'Missing'}</b></div>
      </header>
      {leadId ? <FinishEstimate leadId={leadId} /> : <p className="error">This opportunity ID is missing.</p>}
    </>
  );
}
