/**
 * Domain rule violations. Business conflicts (a job that is not ready to close,
 * a stale draft) descend from this type and stay conflicts.
 */
export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainRuleError';
  }
}

/**
 * The actor is authenticated and the command is well-formed, but this role
 * may not perform it. Distinct from a business conflict so an API can answer
 * 403 without turning "not ready to close" into a permissions error.
 */
export class RoleRefusalError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'RoleRefusalError';
  }
}
