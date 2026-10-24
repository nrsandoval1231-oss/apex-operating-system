import { Link } from 'react-router';
import Icon, { type IconName } from '../components/Icon';
const tools: { to: string; title: string; detail: string; icon: IconName }[] = [
  { to: '/designer', title: 'Designer', detail: 'Plan and design your next project.', icon: 'designer' },
  { to: '/historical', title: 'History', detail: 'Find completed and historical projects.', icon: 'history' },
  { to: '/brief', title: 'Brief', detail: 'Review the operational owner brief.', icon: 'brief' },
];
export default function More() {
  return <main><div className="title-block"><div><h1>More</h1><p className="shell-muted">Your workspace tools</p></div></div>
    <div className="more-tools">{tools.map(tool => <Link key={tool.to} to={tool.to} className="more-tool"><Icon name={tool.icon} size={28} /><span><strong>{tool.title}</strong><small>{tool.detail}</small></span><span aria-hidden="true">→</span></Link>)}</div>
  </main>;
}
