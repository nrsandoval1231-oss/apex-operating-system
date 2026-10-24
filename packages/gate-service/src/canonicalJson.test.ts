import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonicalJson.js';

describe('retained takeoff/proposal canonical JSON', () => {
  it('sorts nested object keys without changing array order or JSON values', () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }, null, false], a: { y: 'proof', x: 0 } }))
      .toBe('{"a":{"x":0,"y":"proof"},"z":[{"a":1,"b":2},null,false]}');
    expect(canonicalJson({ a: { x: 0, y: 'proof' }, z: [{ a: 1, b: 2 }, null, false] }))
      .toBe(canonicalJson({ z: [{ b: 2, a: 1 }, null, false], a: { y: 'proof', x: 0 } }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});
