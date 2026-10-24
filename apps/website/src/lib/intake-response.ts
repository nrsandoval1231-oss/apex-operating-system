/** Intake acknowledges accepted/duplicate with the submitted lead_id (01-intake.ts). */
export function isIntakeResponseAccepted(body: unknown, leadId: string): boolean {
  if (typeof body !== 'object' || body === null || !leadId) return false;
  const outcome = body as { status?: unknown; lead_id?: unknown; canonical_lead_id?: unknown };
  return (outcome.status === 'accepted' || outcome.status === 'duplicate') &&
    outcome.lead_id === leadId && typeof outcome.canonical_lead_id === 'string' && outcome.canonical_lead_id.length > 0;
}
