const byId = (id) => document.getElementById(id);

const TOKEN_KEY = 'apex-gate-token';

/*
 * The session is shared with Apex OS through `localStorage` on this origin, so
 * signing in once at /app signs you in here too. Read through a helper rather
 * than captured at load: another tab can sign in or out while this page is open.
 */
const readSession = () => {
  try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
};

const state = {
  token: readSession(),
  jobId: (() => { try { return localStorage.getItem('apex-job-id') ?? ''; } catch { return ''; } })(),
  gate: null,
  plan: [],
  jobs: [],
};
const jobInput = byId('job-id');
const tokenInput = byId('token');
jobInput.value = state.jobId;

/**
 * Who is signed in, read from the token itself.
 *
 * Display only — the server verifies the signature and decides the role, and
 * nothing here is trusted for anything. Showing a name matters because the
 * session now outlives the tab: somebody has to be able to notice they are
 * about to sign a hold point as the last person who used this phone.
 */
const describeSession = (token) => {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
    return claims.email ?? claims.name ?? claims.sub ?? 'this device';
  } catch {
    // A pilot token that does not decode is still usable; the server is the judge.
    return 'this device';
  }
};

const renderSession = () => {
  const known = state.token !== '' && describeSession(state.token) !== null;
  byId('session-known').classList.toggle('hidden', !known);
  byId('session-missing').classList.toggle('hidden', known);
  if (known) byId('session-user').textContent = describeSession(state.token);
  else if (state.token !== '') {
    setError('setup-error', 'That session has expired. Sign in again to continue.');
    state.token = '';
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      // Omitted when empty: the server may be in single-machine pilot mode,
      // where a local request needs no token. It answers 403 if it is not.
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
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
    /*
     * Choosing a file uploads it. Pressing a second button afterwards added
     * nothing — by the time somebody has picked a photograph the intention is
     * not in doubt — and it was two actions on a phone, outdoors, with the
     * camera roll already open.
     *
     * The status line replaces the button rather than the feedback. Uploads
     * genuinely fail: a wrong evidence kind is refused, and a site photograph
     * over cellular takes real time. Losing the button must not lose the sense
     * that something is happening.
     */
    const uploadStatus = element('p', 'upload-status', '');
    file.disabled = !state.gate || state.gate.status === 'not-started';
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      setError('workspace-error', '');
      uploadStatus.textContent = `Uploading ${selected.name}…`;
      file.disabled = true;
      try {
        const kind = selected.type === 'application/pdf' ? 'document' : selected.type === 'video/mp4' ? 'video' : 'photo';
        if (!requirement.acceptedEvidenceKinds.includes(kind)) {
          throw new Error(`This requirement does not accept ${kind} evidence.`);
        }
        await request(`/api/gates/${state.gate.gateInstanceId}/evidence`, {
          method: 'POST', idempotent: true,
          body: JSON.stringify({ requirementKey: requirement.key, kind, mimeType: selected.type, contentBase64: await fileAsBase64(selected), capturedAt: new Date().toISOString() }),
        });
        await refresh();
        render();
      } catch (error) {
        uploadStatus.textContent = '';
        file.disabled = false;
        file.value = '';
        setError('workspace-error', error);
      }
    });
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
    controlsActions.append(pass, fail);
    controls.append(fileLabel, uploadStatus, noteLabel, controlsActions);
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
  /*
   * The customer's name, not a 26-character id. Whoever is holding this phone
   * knows the job as "Gamble"; the id is for the machine and belongs behind the
   * detail, not at the top of the screen somebody works from.
   */
  const job = state.jobs.find((candidate) => candidate.jobId === state.gate.jobId);
  byId('job-label').textContent = job?.customerName ?? state.gate.jobId;
  byId('revision-label').textContent = state.gate.approvedTakeoffRevisionId;
  const status = byId('gate-status');
  status.textContent = state.gate.status;
  status.className = `status ${state.gate.status}`;

  /*
   * Name the Gate that is actually open. The page was written when pre-gunite
   * was the only template and kept saying so after seven shipped — including
   * "Authorize gunite" above the release button on a Permit Gate, which is the
   * wrong sentence to put over an irreversible hold point. If the plan cannot
   * name it, say nothing rather than name it wrongly.
   */
  const entry = state.plan.find((candidate) => candidate.definitionKey === state.gate.definitionKey);
  const gateName = entry?.title ?? null;
  byId('gate-title').textContent = gateName === null ? 'Gate' : `${gateName} Gate`;
  byId('release-title').textContent = gateName === null
    ? 'Authorize this hold point'
    : `Authorize ${gateName.toLowerCase()}`;

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
  const evidenceComplete = passed === state.gate.requirements.length
    && state.gate.requirements.every((requirement) => !requirement.evidenceRequired || requirement.evidenceIds.length > 0);
  const awaiting = state.gate.status === 'awaiting-countersign';
  const ready = awaiting || (evidenceComplete && state.gate.status !== 'released' && state.gate.status !== 'not-started');
  const release = byId('release');
  /*
   * A released Gate has no button at all. Showing a greyed "Release" on work
   * that is finished and immutable invites a press and then refuses it; the
   * sentence beside it already says what happened.
   */
  release.classList.toggle('hidden', state.gate.status === 'released');
  release.disabled = !ready;
  release.textContent = awaiting
    ? 'Countersign and release'
    : state.gate.countersignRoles.length > 0 ? 'Sign off' : 'Release';
  byId('release-help').textContent =
    state.gate.status === 'released'
      ? 'Released. Everything this Gate triggers was projected from that event.'
      : awaiting
        ? `Signed off. An owner other than the signer must countersign before this Gate releases.`
        : ready
          ? state.gate.countersignRoles.length > 0
            ? 'All required proof is present. Signing off does not release the Gate; an owner must countersign.'
            : 'All required proof and evaluations are present.'
          : 'Release stays locked until every required item has evidence and a passing evaluation.';
};

/**
 * Load the job's Gate plan into the picker. Apex runs seven Gate templates, so
 * the console can no longer assume pre-gunite. Gates already opened are labelled
 * with their state; the rest are labelled as not yet opened, never as skipped.
 */
/**
 * Fill the job picker from the jobs this signed-in person can see.
 *
 * The server already scopes `/api/jobs` to the actor, so the list is what they
 * are allowed to work on rather than everything that exists. A job with no
 * customer name recorded shows its id: the intake payload may genuinely not
 * carry a name, and inventing a label for it would be worse than an ugly one.
 */
const loadJobChoices = async () => {
  const choice = byId('job-choice');
  const jobs = await request('/api/jobs');
  state.jobs = jobs;
  clear(choice);

  if (jobs.length === 0) {
    choice.append(element('option', '', 'No jobs on this account'));
    return;
  }

  const placeholder = element('option', '', 'Choose a job…');
  placeholder.value = '';
  choice.append(placeholder);

  jobs.forEach((job) => {
    const label = job.customerName ?? job.jobId;
    const where = job.addressLine ? ` — ${job.addressLine}` : '';
    const option = element('option', '', `${label}${where}`);
    option.value = job.jobId;
    choice.append(option);
  });

  // Re-select whatever this device was last working on, if it is still listed.
  if (jobs.some((job) => job.jobId === state.jobId)) choice.value = state.jobId;
};

const loadGateChoices = async () => {
  const choice = byId('gate-choice');
  const plan = await request(`/api/jobs/${state.jobId}/gates`);
  state.plan = plan;
  clear(choice);
  plan.forEach((entry) => {
    const label = entry.status === null ? 'not opened' : entry.status;
    const draw = entry.drawCode === null ? '' : ' · releases a draw';
    const seal = entry.requiresCountersign ? ' · needs countersign' : '';
    /*
     * `Node.append` returns undefined, so reading `.lastChild` off its result
     * threw on the first iteration and the picker only ever listed one Gate —
     * whichever came first. Six of the seven templates were unreachable from the
     * field since they were introduced. Build the option, then append it.
     */
    const option = element('option', '', `${entry.title} — ${label}${draw}${seal}`);
    option.value = entry.definitionKey;
    choice.append(option);
  });
  /*
   * Land on the Gate somebody is most likely to want, and say so when there is
   * none. Falling through to the first option meant a job with every Gate
   * released reopened the one finished first, complete with a dead Release
   * button — the screen telling somebody there was work left on a job they had
   * just finished.
   */
  const outstanding = plan.find((entry) => entry.status !== 'released');
  if (outstanding) {
    choice.value = outstanding.definitionKey;
    byId('all-released').classList.add('hidden');
  } else if (plan.length > 0) {
    byId('all-released').classList.remove('hidden');
  }
  return plan;
};

const openSelectedGate = async () => {
  const definitionKey = byId('gate-choice').value;
  if (!definitionKey) throw new Error('Choose a Gate to open.');
  state.gate = await request(`/api/jobs/${state.jobId}/gates/${definitionKey}`, { method: 'POST', body: '{}' });
  render();
};

byId('sign-out').addEventListener('click', () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* nothing to clear */ }
  state.token = '';
  renderSession();
  // Someone else's job list must not stay on screen after a sign-out.
  refreshJobChoices();
  render();
});

/*
 * Choosing a job loads its Gates. They used to load only when Open Gate was
 * pressed, so picking a job left the Gate dropdown reading "Choose a job first"
 * with nothing in it — two dropdowns filled by different events, one of which
 * looked broken.
 */
byId('job-choice').addEventListener('change', async () => {
  setError('setup-error', '');
  state.jobId = byId('job-choice').value;
  byId('all-released').classList.add('hidden');
  if (!state.jobId) return;
  try { localStorage.setItem('apex-job-id', state.jobId); } catch { /* not worth failing over */ }
  try { await loadGateChoices(); } catch (error) { setError('setup-error', error); }
});

/** Back to the picker without reloading the browser on a job site. */
byId('change-gate').addEventListener('click', async () => {
  state.gate = null;
  byId('workspace').classList.add('hidden');
  byId('setup').classList.remove('hidden');
  setError('setup-error', '');
  // Refresh the plan: the Gate just finished is no longer the one to offer.
  try { await loadGateChoices(); } catch (error) { setError('setup-error', error); }
});

/* Signing in or out in another tab takes effect here without a reload. */
window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== TOKEN_KEY) return;
  state.token = readSession();
  renderSession();
  // Signing in elsewhere should fill the picker here without a reload.
  refreshJobChoices();
});

byId('open-job').addEventListener('click', async () => {
  setError('setup-error', '');
  // A typed id wins, so the fallback still works for a job the list cannot show.
  state.jobId = jobInput.value.trim() || byId('job-choice').value;
  // A pasted pilot token is a deliberate override; otherwise use the shared session.
  const pasted = tokenInput.value.trim();
  state.token = pasted !== '' ? pasted : readSession();
  if (!state.jobId) return setError('setup-error', 'Choose a job first.');
  if (!state.token) return setError('setup-error', 'Sign in first, or supply a pilot token.');
  try { localStorage.setItem('apex-job-id', state.jobId); } catch { /* not worth failing over */ }
  if (pasted !== '') {
    try { localStorage.setItem(TOKEN_KEY, pasted); } catch { /* in-memory is enough */ }
    renderSession();
  }
  try {
    await loadGateChoices();
    await openSelectedGate();
  } catch (error) { setError('setup-error', error); }
});

byId('gate-choice').addEventListener('change', async () => {
  if (!state.jobId || !state.token) return;
  setError('setup-error', '');
  try { await openSelectedGate(); } catch (error) { setError('setup-error', error); }
});

byId('release').addEventListener('click', (event) => run(event.currentTarget, async () => {
  const countersigning = state.gate.status === 'awaiting-countersign';
  const prompt = countersigning
    ? 'Countersign this hold point? This releases the Gate and the work it authorizes.'
    : state.gate.countersignRoles.length > 0
      ? 'Sign off this hold point? It will not release until an owner countersigns.'
      : 'Release this Gate from the verified evidence above?';
  if (!confirm(prompt)) return;
  const path = countersigning ? 'countersign' : 'release';
  const result = await request(`/api/gates/${state.gate.gateInstanceId}/${path}`, { method: 'POST', idempotent: true, body: '{}' });
  state.gate = result.state;
}));

/* Reflect the shared session as soon as the page loads. */
renderSession();

/**
 * Populate the job picker on load, and again whenever a session appears.
 *
 * A failure here is reported but not fatal: the typed-id fallback still works,
 * and a field user who cannot list jobs should still be able to open one they
 * were sent directly.
 */
const refreshJobChoices = () => {
  const choice = byId('job-choice');
  if (!state.token) {
    clear(choice);
    choice.append(element('option', '', 'Sign in to list jobs'));
    return;
  }
  loadJobChoices().catch((error) => {
    clear(choice);
    choice.append(element('option', '', 'Could not load jobs'));
    setError('setup-error', error);
  });
};

refreshJobChoices();
