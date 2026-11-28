/** The seed kept in the URL: a whole number, with a default when it is missing or odd. */
export const seedFrom = (text: string | undefined, fallback = 373): number => {
  const value = Number(text);
  return text !== undefined && Number.isInteger(value) && value >= 0 && value < 1e9 ? value : fallback;
};
