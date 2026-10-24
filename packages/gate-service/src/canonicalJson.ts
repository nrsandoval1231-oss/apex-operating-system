/**
 * JSON with every object key sorted, at every depth. Arrays keep their order —
 * position is meaning in a list and sorting one would destroy it.
 */
export const canonicalJson = (value: unknown): string => {
  const canonical = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(canonical);
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.keys(node as Record<string, unknown>)
          .sort()
          .map((key) => [key, canonical((node as Record<string, unknown>)[key])]),
      );
    }
    return node;
  };
  return JSON.stringify(canonical(value));
};

