/** Parse a deliberately entered percentage; an empty field is not a zero decision. */
export const parseFeeRateBps = (raw: string): number => {
  if (!raw.trim()) throw new Error('Enter the approved fee from 0% through 100%.');
  const percent = Number(raw);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Enter the approved fee from 0% through 100%.');
  }
  return Math.round(percent * 100);
};
