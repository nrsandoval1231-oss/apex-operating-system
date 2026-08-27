/**
 * Sheet rotation for the plan view.
 *
 * A quarter turn of the DRAWING, not of the pool. The model is untouched: the
 * shallow end is still the end where the water is 3'-6", the depth profile still
 * runs shallow to deep, and every `Placement` still names the physical wall its
 * object is built into. Rotating is what a drafter does to line the plan up with
 * the lot as it is walked, or to get a better printed scale.
 *
 * On scale, worth being exact about which way the benefit runs: the plan sheet
 * is always 11x17 LANDSCAPE, so turning a drawing that is DEEPER than it is wide
 * — a site carrying front and rear property lines — is what buys a bigger scale.
 * Turning a long pool that already fits the sheet's shape buys nothing. The
 * tests pin both halves of that.
 *
 * WHY A VIEW TRANSFORM AND NOT A MODEL CHANGE
 *
 * The alternative considered was rotating the model — reassigning which wall is
 * "shallow" as the drawing turns. It is the wrong trade twice over:
 *
 *   1. Shallow and deep are physical. `profile.ts` integrates depth from the
 *      shallow end wall to the deep end wall, excavation layers off that
 *      profile, and the section view draws it. Redefining "shallow" to achieve a
 *      presentation change would rewrite the physics to move the paper.
 *   2. Quantities must provably not move. `placement.ts` is imported by exactly
 *      one non-test module — the renderer — so a rotation that lives in the
 *      renderer cannot reach the seventeen signed quantities or the digest over
 *      them. A model rotation would edit `Placement` inside the job file and put
 *      that guarantee back on the table.
 *
 * WHAT THIS DELIBERATELY CANNOT DO
 *
 * It cannot put the deep end toward the house. The house is drawn off the top
 * long wall and the equipment pad off the bottom, and a rotation turns those
 * with the pool — the relationships are preserved, which is the point. Changing
 * which wall the house is on is a different feature and a different data change
 * (a `houseWall`, and property lines keyed to a pool wall rather than to a plan
 * edge). Rotation must not be made to fake it: a plan that shows the house on
 * the wrong side of the pool is worse than one that shows it on a fixed side.
 *
 * Everything here is pure and unit-tested, so the drag handler contains no
 * geometry of its own — same discipline as `placement.ts`.
 */

/** Quarter turns clockwise. */
export type QuarterTurns = 0 | 1 | 2 | 3;

/** A size in SVG user units. */
export interface SizePx {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** A point in SVG user units. */
export interface PointPx {
  readonly x: number;
  readonly y: number;
}

/**
 * Fold any integer onto 0..3, so "rotate right" can just add one forever.
 *
 * Non-finite and fractional inputs collapse to 0 rather than throwing: this sits
 * behind a toolbar button and a persisted preference, and a corrupted stored
 * value should show an unrotated plan, not an empty one.
 */
export function normalizeTurns(value: number): QuarterTurns {
  if (!Number.isFinite(value)) return 0;
  const whole = Math.trunc(value);
  return (((whole % 4) + 4) % 4) as QuarterTurns;
}

/** Degrees clockwise for a quarter-turn count. */
export function rotationDegrees(turns: QuarterTurns): number {
  return turns * 90;
}

/** Does this turn swap the drawing's width and height? */
export function swapsAxes(turns: QuarterTurns): boolean {
  return turns === 1 || turns === 3;
}

/**
 * The sheet's size after rotating.
 *
 * This is the whole reason rotation lives in the layout rather than in a CSS
 * transform on the finished SVG: `planPrintScale` picks the largest
 * architectural scale that fits the drawing on 11x17, and it reads these
 * numbers. A rotation that did not swap them would turn the drawing on screen
 * and still choose the scale for the orientation it no longer has.
 */
export function rotatedSize(turns: QuarterTurns, size: SizePx): SizePx {
  return swapsAxes(turns)
    ? { widthPx: size.heightPx, heightPx: size.widthPx }
    : { widthPx: size.widthPx, heightPx: size.heightPx };
}

/** The same swap in feet, for the content extents the print scale reads. */
export function rotatedExtentFt(
  turns: QuarterTurns,
  contentWidthFt: number,
  contentHeightFt: number,
): { readonly contentWidthFt: number; readonly contentHeightFt: number } {
  return swapsAxes(turns)
    ? { contentWidthFt: contentHeightFt, contentHeightFt: contentWidthFt }
    : { contentWidthFt, contentHeightFt };
}

/**
 * The transform that turns the drawing group.
 *
 * Each case maps the unrotated content box onto the rotated one with its corner
 * at the origin, so the SVG needs no negative viewBox and the outer element's
 * width and height are simply the rotated size.
 *
 * `size` is always the UNROTATED size — the box the group's contents were laid
 * out in. Passing the rotated one is the easy mistake and puts the drawing off
 * the sheet, so the tests pin both directions.
 */
export function contentTransform(turns: QuarterTurns, size: SizePx): string {
  const { widthPx: w, heightPx: h } = size;
  switch (turns) {
    case 1: return `translate(${round(h)} 0) rotate(90)`;
    case 2: return `translate(${round(w)} ${round(h)}) rotate(180)`;
    case 3: return `translate(0 ${round(w)}) rotate(270)`;
    default: return '';
  }
}

/**
 * A point in the rotated sheet, back in the coordinates the drawing was laid
 * out in.
 *
 * This is what a drag maps through. The pointer arrives in the outer SVG's
 * space; every rule in `placement.ts` is written in plan feet off the unrotated
 * layout, and stays that way. One inverse in one place is the difference between
 * rotation being a view concern and rotation leaking into every handler.
 */
export function inverseContentPoint(
  turns: QuarterTurns,
  point: PointPx,
  size: SizePx,
): PointPx {
  const { x: px, y: py } = point;
  const { widthPx: w, heightPx: h } = size;
  switch (turns) {
    case 1: return { x: py, y: h - px };
    case 2: return { x: w - px, y: h - py };
    case 3: return { x: w - py, y: px };
    default: return { x: px, y: py };
  }
}

/**
 * Keep a label readable.
 *
 * Text inside the rotated group turns with it, which at 180° is upside down and
 * at 90° is on its side. Counter-rotating each label about its own anchor leaves
 * the anchor where it was and the text horizontal, at every turn — so a
 * dimension always reads left to right and nobody has to tilt the sheet or their
 * head to read a number they are about to build to.
 *
 * Returns an empty string at 0 turns so an unrotated drawing emits exactly the
 * markup it always has, and the existing snapshot-shaped assertions still hold.
 */
export function textTransform(turns: QuarterTurns, anchor: PointPx): string {
  if (turns === 0) return '';
  return ` transform="rotate(${-rotationDegrees(turns)} ${round(anchor.x)} ${round(anchor.y)})"`;
}

/**
 * A screen direction, in the unrotated layout's axes.
 *
 * The same inverse as `inverseContentPoint` with the translation dropped, since
 * a direction has no origin. Used by the keyboard nudge: "left" means left on
 * the sheet the builder is looking at, and on a sheet turned 180° that is the
 * opposite way along the wall. Without this the arrow keys quietly run backwards
 * at half the turns, which reads as the tool being broken.
 */
export function inverseDirection(turns: QuarterTurns, dx: number, dy: number): PointPx {
  switch (turns) {
    case 1: return { x: dy, y: -dx };
    case 2: return { x: -dx, y: -dy };
    case 3: return { x: -dy, y: dx };
    default: return { x: dx, y: dy };
  }
}

/**
 * Rotation for text that belongs to a dimension line.
 *
 * A free label wants to be horizontal always (`textTransform`). A dimension's
 * text is different: it reads ALONG its own dimension line, which is why the
 * vertical dimensions already carry -90 before any sheet rotation exists. Turn
 * the sheet and that alignment should turn with it — a vertical dimension that
 * becomes horizontal should read horizontally.
 *
 * What must never happen is upside down, or reading top-to-bottom. So the
 * resulting angle is folded onto [-90, 90): every dimension reads either left to
 * right or bottom to top, at every turn, exactly as it does on an unrotated
 * sheet. This is the "inverts at 180°" case, generalised so 90 and 270 are
 * handled by the same rule rather than by three special cases.
 *
 * `baseDegrees` is the rotation the dimension already had at rest — 0 for a
 * horizontal dimension, -90 for a vertical one. Returns the angle to emit.
 */
export function alignedTextRotation(turns: QuarterTurns, baseDegrees: number): number {
  const theta = rotationDegrees(turns);
  const onSheet = theta + baseDegrees;
  // Text orientation is meaningful modulo 180: a line of text rotated 180° is
  // the same line upside down, and one of the two is always the readable one.
  const folded = (((onSheet % 180) + 180) % 180);
  const readable = folded >= 90 ? folded - 180 : folded;
  return readable - theta;
}

/** Human label for the toolbar and the title block. */
export function rotationLabel(turns: QuarterTurns): string {
  return turns === 0 ? 'North up' : `Rotated ${rotationDegrees(turns)}°`;
}

const round = (value: number) => Number(value.toFixed(2));
