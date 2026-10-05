import { listingUrl, type Animal } from './verhuisdieren.ts';

export interface TelegramConfig {
  token: string;
  chatId: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso: string | null): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatCaption(animal: Animal): string {
  const field = (label: string, value: string | null | undefined) =>
    `<b>${label}:</b> ${escapeHtml(value || 'unknown')}`;
  return [
    '🐶 <b>New dog found!</b>',
    '',
    field('Name', animal.name),
    field('Breed', animal.race),
    field('Age', animal.age),
    field('City', animal.address?.city),
    field('Reserved', animal.isReserved ? 'Yes' : 'No'),
    field('Published', formatDate(animal.publishedAt)),
  ].join('\n');
}

async function callTelegram(config: TelegramConfig, method: string, payload: object): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, ...payload }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (body.ok) return;
    const retryAfter = body.parameters?.retry_after;
    if (res.status === 429 && retryAfter && attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    // Never include the URL in errors: it contains the bot token.
    throw new Error(`Telegram ${method} failed: HTTP ${res.status} ${body.description ?? ''}`.trim());
  }
}

export async function sendDogAlert(config: TelegramConfig, animal: Animal): Promise<void> {
  const caption = formatCaption(animal);
  const reply_markup = {
    inline_keyboard: [[{ text: '🔗 View listing', url: listingUrl(animal) }]],
  };
  if (animal.thumbnail) {
    try {
      await callTelegram(config, 'sendPhoto', {
        photo: animal.thumbnail,
        caption,
        parse_mode: 'HTML',
        reply_markup,
      });
      return;
    } catch (err) {
      // Telegram sometimes can't fetch an image URL; fall back to a text message.
      console.warn(`Photo send failed for ${animal.id}, falling back to text: ${String(err)}`);
    }
  }
  await callTelegram(config, 'sendMessage', { text: caption, parse_mode: 'HTML', reply_markup });
}

export async function sendText(config: TelegramConfig, text: string): Promise<void> {
  await callTelegram(config, 'sendMessage', { text, parse_mode: 'HTML' });
}
