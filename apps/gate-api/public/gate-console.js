const byId = (id) => document.getElementById(id);
const state = { token: sessionStorage.getItem('apex-gate-token') ?? '', jobId: sessionStorage.getItem('apex-job-id') ?? '', gate: null };
const jobInput = byId('job-id');
const tokenInput = byId('token');
jobInput.value = state.jobId;
tokenInput.value = state.token;

const request = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${state.token}`,
      'content-type': 'application/json',
      ...(options.idempotent ? { 'idempotency-key': crypto.randomUUID() } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with HTTP ${response.status}.`);
  }
  return response.json();
};

const fileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.readAsDataURL(file);
});

const setError = (id, error) => { byId(id).textContent = error instanceof Error ? error.message : String(error); };
const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const run = async (button, action) => {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Working…';
  setError('workspace-error', '');
  try { await action(); } catch (error) { setError('workspace-error', error); }
  finally { button.textContent = original; render(); }
};

const refresh = async () => {
  state.gate = await request(`/api/gates/${state.gate.gateInstanceId}`);
};

const renderRequirement = (requirement) => {
  const card = element('article', `requirement ${requirement.status}`);
  const head = element('div', 'requirement-head');
  const title = element('h3', '', requirement.key.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '));
  head.append(title, element('span', 'badge', requirement.status));
  card.append(head, element('p', '', `Accepted proof: ${requirement.acceptedEvidenceKinds.join(', ')}`));

  if (state.gate.status !== 'released') {
    const controls = element('div', 'requirement-controls');
    const fileLabel = element('label', '', 'Add evidence');
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp,video/mp4,application/pdf';
    fileLabel.append(file);
    const noteLabel = element('label', '', 'Evaluation note');
    const note = document.createElement('textarea');
    note.placeholder = 'Required when failing; useful field context otherwise.';
    noteLabel.append(note);
    const controlsActions = element('div', 'actions');
    const upload = element('button', '', 'Upload proof');
    upload.disabled = !state.gate || state.gate.status === 'not-started';
    upload.addEventListener('click', () => run(upload, async () => {
      const selected = file.files?.[0];
      if (!selected) throw new Error('Choose an evidence file first.');
      const kind = selected.type === 'application/pdf' ? 'document' : selected.type === 'video/mp4' ? 'video' : 'photo';
      if (!requirement.acceptedEvidenceKinds.includes(kind)) throw new Error(`This requirement does not accept ${kind} evidence.`);
      await request(`/api/gates/${state.gate.gateInstanceId}/evidence`, {
        method: 'POST', idempotent: true,
        body: JSON.stringify({ requirementKey: requirement.key, kind, mimeType: selected.type, contentBase64: await fileAsBase64(selected), capturedAt: new Date().toISOString() }),
      });
      await refresh();
    }));
    const pass = element('button', '', 'Pass');
    pass.disabled = requirement.evidenceRequired && requirement.evidenceIds.length === 0;
    pass.addEventListener('click', () => run(pass, async () => {
      await request(`/api/gates/${state.gate.gateInstanceId}/requirements/${encodeURIComponent(requirement.key)}/evaluate`, {
        method: 'POST', idempotent: true, body: JSON.stringify({ outcome: 'passed', ...(note.value.trim() ? { note: note.value.trim() } : {}) }),
      });
      await refresh();
    }));
    const fail = element('button', '', 'Fail');
    fail.addEventListener('click', () => run(fail, async () => {
      if (!note.value.trim()) throw new Error('Record why the requirement failed.');
      await request(`/api/gates/${state.gate.gateInstanceId}/requirements/${encodeURIComponent(requirement.key)}/evaluate`, {
        method: 'POST', idempotent: true, body: JSON.stringify({ outcome: 'failed', note: note.value.trim() }),
      });
      await refresh();
    }));
    controlsActions.append(upload, pass, fail);
    controls.append(fileLabel, noteLabel, controlsActions);
    card.append(controls);
  }
  card.append(element('div', 'proof-count', `${requirement.evidenceIds.length} evidence record${requirement.evidenceIds.length === 1 ? '' : 's'}`));
  return card;
};

const render = () => {
  if (!state.gate) return;
  byId('setup').classList.add('hidden');
  byId('workspace').classList.remove('hidden');
  byId('connection').textContent = 'Authenticated';
  byId('connection').className = 'connection connected';
  byId('job-label').textContent = state.gate.jobId;
  byId('revision-label').textContent = state.gate.approvedTakeoffRevisionId;
  const status = byId('gate-status');
  status.textContent = state.gate.status;
  status.className = `status ${state.gate.status}`;

  const action = byId('gate-action');
  clear(action);
  if (state.gate.status === 'not-started') {
    action.append(element('div', '', 'The approved revision is linked. Start the hold point before collecting proof.'));
    const start = element('button', 'primary', 'Start Gate');
    start.addEventListener('click', () => run(start, async () => {
      await request(`/api/gates/${state.gate.gateInstanceId}/start`, { method: 'POST', idempotent: true, body: '{}' });
      await refresh();
    }));
    action.append(start);
  } else {
    action.append(element('div', '', state.gate.status === 'released' ? 'This release is durable and immutable.' : 'Collect proof, evaluate every requirement, then release.'));
  }

  const requirements = byId('requirements');
  clear(requirements);
  state.gate.requirements.forEach((requirement) => requirements.append(renderRequirement(requirement)));
  const passed = state.gate.requirements.filter((requirement) => requirement.status === 'passed' || requirement.status === 'overridden').length;
  byId('progress').textContent = `${passed} / ${state.gate.requirements.length} clear`;
  const ready = passed === state.gate.requirements.length && state.gate.requirements.every((requirement) => !requirement.evidenceRequired || requirement.evidenceIds.length > 0) && state.gate.status !== 'released' && state.gate.status !== 'not-started';
  const release = byId('release');
  release.disabled = !ready;
  byId('release-help').textContent = state.gate.status === 'released' ? 'Released. Draw eligibility and the customer milestone were projected from this event.' : ready ? 'All required proof and evaluations are present.' : 'Release stays locked until every required item has evidence and a passing evaluation.';
};

byId('open-job').addEventListener('click', async () => {
  setError('setup-error', '');
  state.jobId = jobInput.value.trim();
  state.token = tokenInput.value.trim();
  if (!state.jobId || !state.token) return setError('setup-error', 'Job ID and bearer token are required.');
  sessionStorage.setItem('apex-job-id', state.jobId);
  sessionStorage.setItem('apex-gate-token', state.token);
  try {
    state.gate = await request(`/api/jobs/${state.jobId}/gates/pre-gunite`, { method: 'POST', body: '{}' });
    render();
  } catch (error) { setError('setup-error', error); }
});

byId('release').addEventListener('click', (event) => run(event.currentTarget, async () => {
  if (!confirm('Authorize gunite and project draw eligibility from this verified hold point?')) return;
  const result = await request(`/api/gates/${state.gate.gateInstanceId}/release`, { method: 'POST', idempotent: true, body: '{}' });
  state.gate = result.state;
}));
