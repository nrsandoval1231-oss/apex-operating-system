/**
 * The deck: a drawn area of concrete, not a border width.
 *
 * WHAT CHANGED AND WHY IT IS A QUANTITY-MODEL CHANGE
 *
 * The deck used to be one number — a constant width `w` ringing the pool — and
 * its area was `(L + 2w)(W + 2w) - LW`. That is not what gets poured. A real
 * Apex deck is a slab someone lays out on the lot: wider at the shallow end
 * where people stand, pinched at a property line, square where the yard is
 * square. It also has to work around whatever sits inside it.
 *
 * Two things the old formula got wrong, and both moved the number:
 *
 *   1. It never subtracted an attached spa. The spa's plan footprint was
 *      counted as deck, so every job with an attached spa over-ordered concrete
 *      by the spa's area. On the standard model that is 36 sf.
 *   2. It could not describe a deck that is not a uniform ring, which is most
 *      of them, so the entered width was always a compromise.
 *
 * `yard.deck-area` is one of the seventeen signed quantities, so fixing this
 * changes what the approved-takeoff digest is computed over. That is deliberate
 * and is why the quantity model goes to `designer-quantity-v3`: a consumer
 * holding a v2 revision must not assume the same meaning.
 *
 * Everything here is pure rectangle arithmetic and unit-tested. The renderer and
 * the takeoff both read it, so the slab that is drawn and the slab that is
 * ordered are the same slab.
 */

/** An axis-aligned rectangle in plan feet, relative to the pool origin. */
export interface DeckRect {
  /** Left edge. Negative is beyond the shallow-end wall. ft */
  readonly xFt: number;
  /** Top edge. Negative is beyond the house-side wall. ft */
  readonly yFt: number;
  readonly widthFt: number;
  readonly heightFt: number;
}

export class DeckOutlineError extends Error {}

/** Area of a rectangle, floored at zero so an inverted one cannot add area. */
export function rectArea(rect: DeckRect): number {
  return Math.max(0, rect.widthFt) * Math.max(0, rect.heightFt);
}

/**
 * The overlapping area of two rectangles.
 *
 * Clipping matters: a spa that hangs half outside the poured slab only removes
 * the half that is actually inside it. Subtracting its whole footprint would
 * under-order concrete, which is the expensive direction of wrong.
 */
export function overlapArea(a: DeckRect, b: DeckRect): number {
  const w = Math.min(a.xFt + a.widthFt, b.xFt + b.widthFt) - Math.max(a.xFt, b.xFt);
  const h = Math.min(a.yFt + a.heightFt, b.yFt + b.heightFt) - Math.max(a.yFt, b.yFt);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The slab a 4 ft border used to describe.
 *
 * Kept as a named constructor rather than a default, for two reasons: it is what
 * the preset buttons hand a new job, and it is how an existing job written
 * against the old model is read forward without anyone re-drawing it. A border
 * is one shape a deck can be, not the shape a deck is.
 */
export function deckOutlineFromBorder(
  poolLengthFt: number,
  poolWidthFt: number,
  borderFt: number,
): DeckRect {
  return {
    xFt: -borderFt,
    yFt: -borderFt,
    widthFt: poolLengthFt + 2 * borderFt,
    heightFt: poolWidthFt + 2 * borderFt,
  };
}

/**
 * What is poured: the outline, less everything standing in it.
 *
 * `obstructions` is whatever occupies plan area inside the slab and is not
 * concrete — the pool itself, an attached spa, a planter. Each is clipped to the
 * outline before it is subtracted, and overlaps between obstructions are NOT
 * de-duplicated: the caller passes non-overlapping rectangles, which is what the
 * pool and an attached spa are, since the spa sits outside the pool wall.
 */
export function deckNetArea(
  outline: DeckRect,
  obstructions: readonly DeckRect[],
): number {
  const gross = rectArea(outline);
  const removed = obstructions.reduce((total, item) => total + overlapArea(outline, item), 0);
  // A slab cannot be negative. If someone draws an outline smaller than the pool
  // it sits around, the honest answer is zero deck, not a negative order.
  return Math.max(0, gross - removed);
}

/** Outer perimeter of the slab as drawn. */
export function deckPerimeter(outline: DeckRect): number {
  return 2 * (Math.max(0, outline.widthFt) + Math.max(0, outline.heightFt));
}

/**
 * How far the deck runs from the water to its own edge, on each side.
 *
 * Replaces the single "deck width". A drawn slab has four different margins and
 * the drawing needs all four; drainage needs the longest one.
 */
export function deckMargins(
  outline: DeckRect,
  poolLengthFt: number,
  poolWidthFt: number,
): { readonly leftFt: number; readonly rightFt: number; readonly topFt: number; readonly bottomFt: number } {
  return {
    leftFt: Math.max(0, -outline.xFt),
    topFt: Math.max(0, -outline.yFt),
    rightFt: Math.max(0, outline.xFt + outline.widthFt - poolLengthFt),
    bottomFt: Math.max(0, outline.yFt + outline.heightFt - poolWidthFt),
  };
}

/**
 * The longest uninterrupted run of deck away from the water.
 *
 * This is what the slope has to carry water across, so it is the run the fall
 * calculation uses. The old model used the single deck width, which on a slab
 * that is 4 ft on three sides and 14 ft on the fourth understated the fall by a
 * factor of three — and fall is what decides whether the deck drains or ponds.
 */
export function longestDeckRunFt(
  outline: DeckRect,
  poolLengthFt: number,
  poolWidthFt: number,
): number {
  const m = deckMargins(outline, poolLengthFt, poolWidthFt);
  return Math.max(m.leftFt, m.rightFt, m.topFt, m.bottomFt);
}

/**
 * Refuse a slab that does not contain the pool it is poured around.
 *
 * Not a warning. A deck outline that clips the water is not a deck someone can
 * pour, and the area it would report is a number for a slab nobody is building.
 * Same discipline as the rest of the engine: refuse, and say what is wrong,
 * rather than return a partial answer.
 */
export function assertDeckOutlineContainsPool(
  outline: DeckRect,
  poolLengthFt: number,
  poolWidthFt: number,
): void {
  if (!Number.isFinite(outline.xFt) || !Number.isFinite(outline.yFt)
    || !Number.isFinite(outline.widthFt) || !Number.isFinite(outline.heightFt)) {
    throw new DeckOutlineError('Deck outline has a non-finite dimension.');
  }
  if (outline.widthFt <= 0 || outline.heightFt <= 0) {
    throw new DeckOutlineError(
      `Deck outline must have positive width and height; got ${outline.widthFt} x ${outline.heightFt} ft.`,
    );
  }
  const covers = outline.xFt <= 0
    && outline.yFt <= 0
    && outline.xFt + outline.widthFt >= poolLengthFt
    && outline.yFt + outline.heightFt >= poolWidthFt;
  if (!covers) {
    throw new DeckOutlineError(
      `Deck outline does not contain the pool. The outline runs x ${outline.xFt} to `
      + `${outline.xFt + outline.widthFt} ft and y ${outline.yFt} to ${outline.yFt + outline.heightFt} ft, `
      + `but the pool occupies 0 to ${poolLengthFt} ft by 0 to ${poolWidthFt} ft. `
      + 'Draw the slab around the water, not through it.',
    );
  }
}
