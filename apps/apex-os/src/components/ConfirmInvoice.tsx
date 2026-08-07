import { useState } from 'react';
import { DrawScheduleSchema, type JobDraw } from '@apex/contracts';
import { ApiError, apiSend } from '../api/client';
import InlineForm from './InlineForm';

/**
 * Record that a released draw was invoiced — PRD §9.8.
 *
 * The Today feed has raised "draw released but unbilled" since the action-card
 * engine shipped, and until now there was nowhere to act on it: the endpoint
 * existed, no screen called it, and the card could not be cleared. A card that
 * cannot be cleared teaches the owner the feed is decorative.
 *
 * **Apex OS does not issue invoices.** QuickBooks remains the financial
 * authority; this records that a person issued one, and `invoiced_by` is
 * required by a database constraint rather than by convention. Hence a reference
 * is mandatory — "invoiced" with nothing to look up is a claim, not a record.
 */
export default function ConfirmInvoice({
  jobId,
  draw,
  onDone,
}: {
  jobId: string;
  draw: JobDraw;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (values: Readonly<Record<string, string>>) => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/jobs/${jobId}/draws/${draw.drawCode}/invoice`, DrawScheduleSchema, {
        method: 'POST',
        body: {
          invoiceReference: values.invoiceReference,
          ...(values.dueDate ? { dueDate: values.dueDate } : {}),
        },
      });
      setOpen(false);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error
        ? caught.message
        : 'The invoice could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <>
        <button type="button" className="action action-quiet" onClick={() => setOpen(true)}>
          Confirm invoiced
        </button>
        {error !== null && <p className="attach-error" role="alert">{error}</p>}
      </>
    );
  }

  return (
    <>
      <InlineForm
        title={`Confirm ${draw.label} invoiced`}
        note="Apex OS records what a person invoiced; it does not issue invoices. The reference is what makes this checkable in QuickBooks later."
        fields={[
          { name: 'invoiceReference', label: 'Invoice reference', required: true, placeholder: 'e.g. INV-1042' },
          { name: 'dueDate', label: 'Due date (YYYY-MM-DD)' },
        ]}
        submitLabel="Record it"
        busy={busy}
        onSubmit={confirm}
        onCancel={() => { setOpen(false); setError(null); }}
      />
      {error !== null && <p className="attach-error" role="alert">{error}</p>}
    </>
  );
}
