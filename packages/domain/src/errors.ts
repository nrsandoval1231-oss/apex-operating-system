/**
 * Domain rule violations. A caller that maps these to one HTTP status must not
 * have to enumerate subclasses, so every rule error descends from this type.
 */
export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainRuleError';
  }
}
