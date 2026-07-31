export interface ActionCard {
  id: string;
  type: 'urgent' | 'warning' | 'info' | 'success';
  projectId: string;
  projectName: string;
  location: string;
  title: string;
  description: string;
  reason: string;
  action: string;
  dueTime?: string;
  gateId?: string;
}

export interface GateChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  note?: string;
  required: boolean;
}

export interface Project {
  id: string;
  name: string;
  customer: string;
  location: string;
  value: number;
  currentPhase: string;
  currentGate: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'blocked';
  nextAction: string;
}

export interface Gate {
  id: string;
  name: string;
  projectId: string;
  status: 'not-started' | 'in-progress' | 'ready' | 'passed' | 'blocked';
  checklist: GateChecklistItem[];
  requiredPhotos: number;
  attachedPhotos: number;
}

export const mockActionCards: ActionCard[] = [
  {
    id: '1',
    type: 'urgent',
    projectId: 'proj-001',
    projectName: 'Smith Residence',
    location: '4502 19th St, Lubbock',
    title: 'Sign Pre-Gunite Hold',
    description: 'Pre-gunite inspection checklist is complete and ready for your signoff.',
    reason: 'Gunite crew scheduled for tomorrow 7 AM. Cannot proceed without signed hold.',
    action: 'Review & Sign',
    dueTime: 'Today by 5 PM',
    gateId: 'gate-001'
  },
  {
    id: '2',
    type: 'warning',
    projectId: 'proj-002',
    projectName: 'Johnson Pool',
    location: '7821 Knoxville Ave',
    title: 'Request City Inspection',
    description: 'Steel and plumbing complete. City inspection required before gunite.',
    reason: 'City requires 48-hour notice. Schedule for Thursday to avoid delay.',
    action: 'Request Inspection',
    dueTime: 'Tomorrow by noon'
  },
  {
    id: '3',
    type: 'info',
    projectId: 'proj-003',
    projectName: 'Williams Oasis',
    location: '3405 98th St',
    title: 'Customer Selection Due',
    description: 'Tile and coping selections needed from customer.',
    reason: 'Deck crew scheduled next week. Selections must be confirmed to order materials.',
    action: 'Send Reminder',
    dueTime: 'This week'
  },
  {
    id: '4',
    type: 'success',
    projectId: 'proj-004',
    projectName: 'Davis Pool & Spa',
    location: '5602 89th St',
    title: 'Draw Ready to Invoice',
    description: 'Shell complete and passed inspection. Draw #3 ($28,500) is ready to bill.',
    reason: 'Milestone verified on ' + new Date().toLocaleDateString(),
    action: 'Create Invoice',
    dueTime: 'Ready now'
  }
];

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: 'Smith Residence',
    customer: 'John & Sarah Smith',
    location: '4502 19th St, Lubbock',
    value: 185000,
    currentPhase: 'Steel & Underground',
    currentGate: 'Pre-Gunite Hold',
    progress: 45,
    status: 'on-track',
    nextAction: 'Sign pre-gunite hold'
  },
  {
    id: 'proj-002',
    name: 'Johnson Pool',
    customer: 'Mike Johnson',
    location: '7821 Knoxville Ave',
    value: 142000,
    currentPhase: 'Steel & Underground',
    currentGate: 'Pre-Gunite',
    progress: 38,
    status: 'at-risk',
    nextAction: 'Request city inspection'
  },
  {
    id: 'proj-003',
    name: 'Williams Oasis',
    customer: 'Robert Williams',
    location: '3405 98th St',
    value: 210000,
    currentPhase: 'Tile & Coping',
    currentGate: 'Pre-Deck',
    progress: 72,
    status: 'blocked',
    nextAction: 'Customer tile selection'
  },
  {
    id: 'proj-004',
    name: 'Davis Pool & Spa',
    customer: 'Jennifer Davis',
    location: '5602 89th St',
    value: 168000,
    currentPhase: 'Shell Curing',
    currentGate: 'Pre-Deck',
    progress: 58,
    status: 'on-track',
    nextAction: 'Schedule deck crew'
  }
];

export const mockGates: Gate[] = [
  {
    id: 'gate-001',
    name: 'Pre-Gunite Hold',
    projectId: 'proj-001',
    status: 'ready',
    requiredPhotos: 4,
    attachedPhotos: 4,
    checklist: [
      { id: '1', title: 'Layout and dimensions reverified', completed: true, required: true },
      { id: '2', title: 'Depths and spa dimensions match plan', completed: true, required: true },
      { id: '3', title: 'Steel size, spacing, cover, laps verified', completed: true, required: true },
      { id: '4', title: 'Plumbing pressure test recorded', completed: true, required: true, note: '45 PSI, 30 min hold' },
      { id: '5', title: 'Electrical niches and bonding verified', completed: true, required: true },
      { id: '6', title: 'Equipment vault/pad alignment verified', completed: true, required: true },
      { id: '7', title: 'Hydrostatic relief installed', completed: true, required: true },
      { id: '8', title: 'Substrate condition acceptable', completed: true, required: true },
      { id: '9', title: 'Nozzleman/crew qualification confirmed', completed: true, required: true },
      { id: '10', title: 'Mix design/strength confirmed', completed: true, required: true, note: '4000 PSI specified' },
      { id: '11', title: 'Required photos attached', completed: true, required: true, note: '4/4 uploaded' }
    ]
  },
  {
    id: 'gate-002',
    name: 'Pre-Gunite',
    projectId: 'proj-002',
    status: 'in-progress',
    requiredPhotos: 4,
    attachedPhotos: 2,
    checklist: [
      { id: '1', title: 'Layout and dimensions reverified', completed: true, required: true },
      { id: '2', title: 'Depths and spa dimensions match plan', completed: true, required: true },
      { id: '3', title: 'Steel size, spacing, cover, laps verified', completed: true, required: true },
      { id: '4', title: 'Plumbing pressure test recorded', completed: true, required: true },
      { id: '5', title: 'Electrical niches and bonding verified', completed: true, required: true },
      { id: '6', title: 'Equipment vault/pad alignment verified', completed: true, required: true },
      { id: '7', title: 'Hydrostatic relief installed', completed: false, required: true },
      { id: '8', title: 'Substrate condition acceptable', completed: true, required: true },
      { id: '9', title: 'Nozzleman/crew qualification confirmed', completed: true, required: true },
      { id: '10', title: 'Mix design/strength confirmed', completed: true, required: true },
      { id: '11', title: 'Required photos attached', completed: false, required: true, note: '2/4 uploaded' }
    ]
  }
];

export const phases = [
  'Contract & Deposit',
  'Design Finalization',
  'Engineering / Permit',
  'Pre-Construction',
  'Layout & Excavation',
  'Steel & Underground',
  'Pre-Gunite Hold',
  'Gunite / Shell',
  'Tile & Coping',
  'Decking',
  'Interior Finish',
  'Fill & Startup',
  'Final Inspection',
  'Handover'
];

export const customerMilestones = [
  { id: 'design', label: 'Design', icon: '📐' },
  { id: 'excavation', label: 'Excavation', icon: '🚜' },
  { id: 'shell', label: 'Shell', icon: '🏗️' },
  { id: 'finishes', label: 'Finishes', icon: '✨' },
  { id: 'water', label: 'Water', icon: '💧' },
  { id: 'handover', label: 'Handover', icon: '🔑' }
];