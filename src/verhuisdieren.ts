const API_URL = 'https://api.verhuisdieren.nl/api/profile/animals';
const SITE_URL = 'https://verhuisdieren.nl';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

export interface Animal {
  id: number;
  name: string;
  race: string | null;
  age: string | null;
  slug: string;
  thumbnail: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  isReserved: boolean;
  address: { city: string | null } | null;
}

interface AnimalsPage {
  animals: Animal[];
  lastPage: number;
}

export function listingUrl(animal: Animal): string {
  return `${SITE_URL}/plaatsprofiel/${animal.id}-${animal.slug}/`;
}

function pageUrl(page: number): string {
  const params = new URLSearchParams({
    'filters[animalType]': 'Hond',
    'filters[hideReserved]': 'false',
    'filters[type]': 'adopt',
    page: String(page),
  });
  return `${API_URL}?${params}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(page: number): Promise<AnimalsPage> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(pageUrl(page), {
        headers: { Accept: 'application/json', 'User-Agent': 'adopt-pet-bot (personal alert bot)' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body: unknown = await res.json();
      return parsePage(body);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(2_000 * attempt);
    }
  }
  throw new Error(`Failed to fetch page ${page} after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`);
}

// Validate the shape strictly: a malformed response must abort the run rather than
// be mistaken for "no dogs listed".
function parsePage(body: unknown): AnimalsPage {
  if (typeof body !== 'object' || body === null) throw new Error('Response is not a JSON object');
  const { data, meta } = body as { data?: unknown; meta?: { last_page?: unknown } };
  if (!Array.isArray(data)) throw new Error('Response has no "data" array');
  const animals = data.filter(
    (a): a is Animal => typeof a?.id === 'number' && typeof a?.slug === 'string',
  );
  if (animals.length !== data.length) throw new Error('Response contains animals without id/slug');
  const lastPage = typeof meta?.last_page === 'number' ? meta.last_page : 1;
  return { animals, lastPage };
}

/**
 * Fetch up to `maxPages` pages (newest listings first). Throws if any page fails,
 * so callers never act on a partial or broken result.
 */
export async function fetchAnimals(maxPages: number): Promise<Animal[]> {
  const first = await fetchPage(1);
  const animals = [...first.animals];
  const lastPage = Math.min(first.lastPage, maxPages);
  for (let page = 2; page <= lastPage; page++) {
    await sleep(300); // be polite to the API
    animals.push(...(await fetchPage(page)).animals);
  }
  return animals;
}
