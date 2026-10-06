/** Intake acknowledges accepted/duplicate with the submitted lead_id (01-intake.ts). */
export function isIntakeResponseAccepted(body: unknown, leadId: string, production: boolean): boolean {
  if (!production) {
    // Development test hooks can answer with their own shape; quarantine still fails.
    return typeof body !== 'object' || body === null ||
      (body as { status?: unknown }).status !== 'quarantined';
  }
  if (typeof body !== 'object' || body === null || !leadId) return false;
  const outcome = body as { status?: unknown; lead_id?: unknown };
  return (outcome.status === 'accepted' || outcome.status === 'duplicate') &&
    outcome.lead_id === leadId;
}
