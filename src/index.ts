import { fetchAnimals, listingUrl, type Animal } from './verhuisdieren.ts';
import { isWantedBreed } from './match.ts';
import { loadState, saveState } from './state.ts';
import { sendDogAlert, sendText, type TelegramConfig } from './telegram.ts';

const STATE_FILE = process.env.STATE_FILE || 'state/seen.json';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
// Listings are sorted newest first (24 per page). Regular runs only need the first
// few pages; the baseline scans everything so no existing dog is ever alerted on.
const PAGES_PER_RUN = Number(process.env.PAGES_PER_RUN) || 3;
const BASELINE_MAX_PAGES = 200;

function telegramConfig(): TelegramConfig | null {
  if (DRY_RUN) return null;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set (GitHub Actions secrets). ' +
        'Use DRY_RUN=1 to run without Telegram.',
    );
  }
  return { token, chatId };
}

function describe(animal: Animal): string {
  return `#${animal.id} ${animal.name} (${animal.race}, ${animal.address?.city ?? '?'}) ${listingUrl(animal)}`;
}

async function main(): Promise<number> {
  const telegram = telegramConfig();
  const state = await loadState(STATE_FILE);
  const isBaseline = state === null;

  let animals: Animal[];
  try {
    animals = await fetchAnimals(isBaseline ? BASELINE_MAX_PAGES : PAGES_PER_RUN);
  } catch (err) {
    // Transient API problem: leave state untouched and try again on the next run.
    // Exit 0 so a flaky API doesn't produce a failed-workflow email every 5 minutes.
    console.log(`::warning::Verhuisdieren API unavailable, skipping this run: ${String(err)}`);
    return 0;
  }

  const matches = animals.filter((a) => isWantedBreed(a.race));
  console.log(`Fetched ${animals.length} dogs, ${matches.length} matching breed.`);

  if (isBaseline) {
    const now = new Date().toISOString();
    await saveState(STATE_FILE, { initializedAt: now, seenIds: matches.map((a) => a.id) });
    console.log(`Baseline created with ${matches.length} existing matching dogs (no alerts sent):`);
    matches.forEach((a) => console.log(`  ${describe(a)}`));
    if (telegram) {
      await sendText(
        telegram,
        `✅ <b>adopt-pet-bot is running</b>\n\nTracking ${matches.length} existing Golden Retriever / ` +
          `Berner Sennen listings as a baseline. You'll get a message when a new one appears.`,
      );
    }
    return 0;
  }

  const seen = new Set(state.seenIds);
  // Oldest first so alerts arrive in publication order.
  const fresh = matches.filter((a) => !seen.has(a.id)).reverse();
  if (fresh.length === 0) {
    console.log('No new matching dogs.');
    return 0;
  }

  let failed = 0;
  for (const animal of fresh) {
    if (!telegram) {
      console.log(`[dry run] Would alert: ${describe(animal)}`);
      continue;
    }
    try {
      await sendDogAlert(telegram, animal);
      // Mark as seen only after a successful send, so failed alerts are retried.
      seen.add(animal.id);
      console.log(`Alert sent: ${describe(animal)}`);
    } catch (err) {
      failed++;
      console.log(`::error::Failed to send alert for #${animal.id}: ${String(err)}`);
    }
  }

  if (!DRY_RUN) {
    await saveState(STATE_FILE, { ...state, seenIds: [...seen] });
  }
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
