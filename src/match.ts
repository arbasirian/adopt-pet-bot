/**
 * Breed patterns, compared against the `race` field after lowercasing and stripping
 * everything except letters. That makes matching case-insensitive and tolerant of
 * spacing/punctuation variants seen in real listings ("Berner Sennen", "Bernersennen",
 * "Mechelaar x bernersenner", "Labrador/ golden retriever").
 *
 * There is deliberately no bare "golden" pattern: it would match Goldendoodles.
 */
const BREED_PATTERNS = [
  'goldenretriever', // Golden Retriever
  'bernersenn', // Berner Sennen, Berner Sennenhond, Bernersenner
  'bennersenn', // "Benner Sennen", a typo seen in a real listing
  'bernesemountaindog', // Bernese Mountain Dog
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z]/g, '');
}

export function isWantedBreed(race: string | null | undefined): boolean {
  if (!race) return false;
  const normalized = normalize(race);
  return BREED_PATTERNS.some((pattern) => normalized.includes(pattern));
}
