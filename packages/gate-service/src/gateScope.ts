const SCOPE_GATED_LINES: Readonly<
  Record<string, { readonly code: number; readonly name: string }>
> = {
  'cover-install': { code: 900, name: 'Cover' },
  'automation-programming-complete': { code: 1200, name: 'Automation' },
};

export interface SignedScopeLine {
  readonly name?: string;
  readonly resolved?: boolean;
  readonly scopeStatus?: string;
  readonly code?: number;
}

/** No signed proposal keeps every active template. A signed one drops lines left out of scope. */
export const gateRequiredByScope = (
  definitionKey: string,
  scope: readonly SignedScopeLine[] | null,
): boolean => {
  const optional = SCOPE_GATED_LINES[definitionKey];
  if (optional === undefined || scope === null) return true;
  const line = scope.find(
    (item) => item.code === optional.code || item.name === optional.name,
  );
  if (!line) return false;
  if (
    line.scopeStatus === 'not-applicable' ||
    line.scopeStatus === 'unresolved'
  )
    return false;
  if (line.scopeStatus === 'quoted') return true;
  return line.resolved === true;
};
