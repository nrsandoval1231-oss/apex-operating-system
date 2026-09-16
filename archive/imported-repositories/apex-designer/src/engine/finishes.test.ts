/**
 * Finishes, yard & drainage, and cover.
 *
 * Hand checks for the standard model: waterline perimeter 114 ft (90 pool + 24
 * spa), wetted area 1,014.16 sf, one bench with an 8 ft leading edge.
 */

import { describe, expect, it } from 'vitest';
import { computeFinishes } from './finishes.ts';
import { computeYard, MAX_DECK_SLOPE_IN_PER_FT } from './yard.ts';
import { computeCover } from './cover.ts';
import { computeGeometry } from './geometry.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { CoverParams, Job } from './types.ts';

const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const geom = computeGeometry(STANDARD_MODEL);
const fin = computeFinishes(STANDARD_MODEL, geom)!;

describe('finishes', () => {
  it('waterline tile net is the waterline perimeter: 114 lf', () => {
    close(fin.waterlineTileLf.net.value, 114);
  });

  it('waste is a separate line at 10%, and ordered is net plus waste', () => {
    close(fin.waterlineTileLf.waste.value, 11.4);
    close(fin.waterlineTileLf.ordered.value, 125.4);
    expect(fin.waterlineTileLf.wastePct).toBe(0.1);
  });

  it('tile area is the ordered length times the 6 in band: 62.7 sf', () => {
    close(fin.waterlineTileSf.value, (125.4 * 6) / 12);
  });

  it('coping is 114 lf net, 5% waste, 120 pieces at 12 in', () => {
    close(fin.copingLf.net.value, 114);
    close(fin.copingLf.ordered.value, 119.7);
    expect(fin.copingPieces.value).toBe(120);
  });

  it('coping pieces always round up — a part piece is a piece', () => {
    expect(fin.copingPieces.value).toBeGreaterThanOrEqual(fin.copingLf.ordered.value);
  });

  it('plaster net is the wetted area: 1,014.16 sf, 5% waste', () => {
    close(fin.plasterSf.net.value, 1014.156, 0.01);
    close(fin.plasterSf.ordered.value, 1014.156 * 1.05, 0.01);
  });

  it('counts the Lubbock leading-edge contrast stripe, which the base code has no concept of', () => {
    close(fin.contrastStripeLf.net.value, 8);
    expect(fin.contrastStripeLf.net.source).toMatch(/411\.5/);
    close(fin.contrastStripeSf.value, (8 * 1.1 * 1) / 12, 0.001);
  });

  it('sums the stripe across every bench, swimout and ledge', () => {
    const many: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        seats: [
          STANDARD_MODEL.pool.seats[0]!,
          { ...STANDARD_MODEL.pool.seats[0]!, id: 'SW1', kind: 'swimout', leadingEdgeLengthFt: 5 },
        ],
      },
    };
    const r = computeFinishes(many, computeGeometry(many))!;
    close(r.contrastStripeLf.net.value, 13);
  });

  it('says so when there is nothing to stripe', () => {
    const none: Job = { ...STANDARD_MODEL, pool: { ...STANDARD_MODEL.pool, seats: [] } };
    const r = computeFinishes(none, computeGeometry(none))!;
    close(r.contrastStripeLf.net.value, 0);
    expect(r.notes.join(' ')).toMatch(/no contrast stripe is required/i);
  });

  it('flags a stripe entered under the 1 in Lubbock minimum instead of silently fixing it', () => {
    const thin: Job = {
      ...STANDARD_MODEL,
      finishes: { ...STANDARD_MODEL.finishes!, contrastStripeHeightIn: 0.5 },
    };
    const r = computeFinishes(thin, geom)!;
    expect(r.notes.join(' ')).toMatch(/under the 1 in Lubbock minimum/i);
  });

  it('warns that the shared spa dam wall is counted on both bodies', () => {
    expect(fin.notes.join(' ')).toMatch(/shared spa dam wall/i);
  });

  it('never folds waste into net', () => {
    for (const q of [fin.waterlineTileLf, fin.copingLf, fin.plasterSf, fin.contrastStripeLf]) {
      expect(q.ordered.value).toBeGreaterThan(q.net.value);
      close(q.ordered.value, q.net.value + q.waste.value, 0.001);
    }
  });

  it('returns nothing when the job carries no finishes inputs', () => {
    expect(computeFinishes({ ...STANDARD_MODEL, finishes: undefined }, geom)).toBeNull();
  });
});

describe('yard & drainage', () => {
  const yard = computeYard(STANDARD_MODEL, geom)!;

  /*
   * The slab is 38 x 23 = 874 sf. Out of it come the pool's 450 sf and the part
   * of the attached spa standing inside the concrete — 4 of its 6 ft, since a
   * 4 ft border stops short of a 6 ft spa, so 4 x 6 = 24 sf.
   *
   * 874 - 450 - 24 = 400.
   *
   * THIS NUMBER MOVED, DELIBERATELY. It read 424 under the old constant-width
   * model, which never subtracted an attached spa and so counted the concrete
   * that the spa is standing on. Every job with an attached spa over-ordered by
   * that much. `yard.deck-area` is one of the seventeen signed quantities, which
   * is why the quantity model went to designer-quantity-v3 rather than being
   * corrected in place.
   */
  it('deck area = 874 slab - 450 pool - 24 spa = 400 sf', () => close(yard.deckArea.value, 400));
  it('deck outer perimeter = 2 x (38 + 23) = 122 ft', () => close(yard.deckPerimeter.value, 122));
  it('fall across a 4 ft deck at 1/4 in per ft = 1 in', () => close(yard.fallAcrossDeck.value, 1));

  it('306.5 is a band: both the minimum and the maximum are checked', () => {
    expect(yard.checks.map((c) => c.id)).toContain('ispsc.306.5.max');
    expect(yard.checks.map((c) => c.id)).toContain('ispsc.306.5.min');
    expect(yard.checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('fails a deck steeper than 1/2 in per foot', () => {
    const steep: Job = { ...STANDARD_MODEL, deck: { ...STANDARD_MODEL.deck!, slopeInPerFt: 0.75 } };
    const r = computeYard(steep, geom)!;
    const max = r.checks.find((c) => c.id === 'ispsc.306.5.max')!;
    expect(max.status).toBe('fail');
    expect(max.governingLimit).toContain(String(MAX_DECK_SLOPE_IN_PER_FT));
  });

  it('fails a deck under the Table 306.5 minimum and names the performance path out', () => {
    const flat: Job = { ...STANDARD_MODEL, deck: { ...STANDARD_MODEL.deck!, slopeInPerFt: 0.125 } };
    const r = computeYard(flat, geom)!;
    const min = r.checks.find((c) => c.id === 'ispsc.306.5.min')!;
    expect(min.status).toBe('fail');
    expect(min.compliancePath).toMatch(/no standing water/i);
  });

  it('drops the minimum check when the job takes the performance path, and says which path it is on', () => {
    const perf: Job = {
      ...STANDARD_MODEL,
      deck: { ...STANDARD_MODEL.deck!, slopeInPerFt: 0.125, usesPerformancePath: true },
    };
    const r = computeYard(perf, geom)!;
    expect(r.checks.find((c) => c.id === 'ispsc.306.5.min')).toBeUndefined();
    expect(r.checks.find((c) => c.id === 'ispsc.306.5.performance')!.status).toBe('flag');
    expect(r.compliancePath).toMatch(/performance path/i);
  });

  it('keeps the Table 306.5 minimum as a job input rather than a hardcoded constant', () => {
    expect(yard.notes.join(' ')).toMatch(/material-dependent/i);
  });
});

describe('cover', () => {
  const cover = (over: Partial<CoverParams> = {}): CoverParams => ({
    manufacturer: 'EXAMPLE',
    model: 'illustrative cover — not a product',
    specSource: 'PLACEHOLDER — no spec sheet has been read',
    specRevisionDate: '0000-00-00 (placeholder)',
    vaultLengthFt: 3,
    vaultWidthFt: 16,
    vaultDepthFt: 2,
    bondBeamDropIn: 2,
    trackLengthFt: 30,
    astmF1346Listed: true,
    servesAsBarrier: true,
    ...over,
  });

  const withCover = (over: Partial<CoverParams> = {}): Job => ({ ...STANDARD_MODEL, cover: cover(over) });

  it('is absent unless the job carries one', () => {
    expect(computeCover(STANDARD_MODEL)).toBeNull();
  });

  it('a listed cover can be the whole barrier compliance path', () => {
    const r = computeCover(withCover())!;
    expect(r.barrierPath).toBe('cover-as-barrier');
    const c = r.checks.find((x) => x.id === 'lubbock.305.1.cover')!;
    expect(c.status).toBe('pass');
    expect(c.message).toMatch(/305\.2 through 305\.7 are exempted/i);
  });

  it('says the ASTM F1346 listing is load-bearing on that decision', () => {
    const r = computeCover(withCover())!;
    expect(r.checks.find((x) => x.id === 'lubbock.305.1.cover')!.message).toMatch(
      /the pool has no barrier at all/i,
    );
  });

  it('hard-fails a cover used as the barrier without an ASTM F1346 listing', () => {
    const r = computeCover(withCover({ astmF1346Listed: false }))!;
    expect(r.barrierPath).toBe('non-compliant');
    const c = r.checks.find((x) => x.id === 'lubbock.305.1.cover')!;
    expect(c.status).toBe('fail');
    expect(c.compliancePath).toMatch(/305\.2 through 305\.7/);
  });

  it('when the cover is not the barrier, says the barrier sections apply in full', () => {
    const r = computeCover(withCover({ servesAsBarrier: false }))!;
    expect(r.barrierPath).toBe('barrier-sections');
    expect(r.checks.find((x) => x.id === 'lubbock.305.1.cover')!.status).toBe('flag');
    expect(r.notes.join(' ')).toMatch(/not modelled in v1/i);
  });

  it('constrains the shell rather than being selected downstream', () => {
    const r = computeCover(withCover())!;
    expect(r.shellConstraints.join(' ')).toMatch(/bond beam drops 2 in/i);
    expect(r.shellConstraints.join(' ')).toMatch(/before the shell is shot/i);
    close(r.bondBeamDrop.value, 2);
  });

  it('fails a vault that does not span the pool width', () => {
    const r = computeCover(withCover({ vaultWidthFt: 12 }))!;
    const c = r.checks.find((x) => x.id === 'cover.vault.width')!;
    expect(c.status).toBe('fail');
    expect(c.message).toMatch(/cannot be trimmed to fit/i);
  });

  it('flags a track shorter than the pool', () => {
    expect(computeCover(withCover({ trackLengthFt: 24 }))!.checks.find((x) => x.id === 'cover.track.length')!.status).toBe('flag');
  });

  it('fails a nonstandard layout without distributor approval', () => {
    const r = computeCover(withCover({ distributorApproval: false }))!;
    expect(r.checks.find((x) => x.id === 'cover.distributor')!.status).toBe('fail');
  });

  it('vault volume = 3 x 16 x 2 = 96 cf, sourced to the spec sheet revision', () => {
    const r = computeCover(withCover())!;
    close(r.vaultVolume.value, 96);
    expect(r.vaultVolume.source).toContain('0000-00-00');
  });

  it('track is two sides', () => close(computeCover(withCover())!.trackLf.value, 60));

  it('states that the vault cut is not yet in the excavation total', () => {
    expect(computeCover(withCover())!.notes.join(' ')).toMatch(/not yet added to the excavation/i);
  });
});
