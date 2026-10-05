/**
 * Prints the chat IDs that recently messaged your bot.
 *
 *   1. Send any message to your bot in Telegram (or add it to a group and post there).
 *   2. read -s TELEGRAM_BOT_TOKEN && export TELEGRAM_BOT_TOKEN   # paste token, not echoed
 *   3. npm run chat-id
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in your environment first (see comment at top of this file).');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const body = (await res.json()) as {
  ok: boolean;
  description?: string;
  result?: Array<Record<string, { chat?: { id: number; type: string; title?: string; username?: string; first_name?: string } }>>;
};

if (!body.ok) {
  console.error(`Telegram error: ${body.description ?? res.status}`);
  process.exit(1);
}

const chats = new Map<number, string>();
for (const update of body.result ?? []) {
  for (const value of Object.values(update)) {
    const chat = typeof value === 'object' && value !== null ? value.chat : undefined;
    if (chat) chats.set(chat.id, `${chat.type}: ${chat.title ?? chat.username ?? chat.first_name ?? ''}`);
  }
}

if (chats.size === 0) {
  console.log('No messages found. Send your bot a message in Telegram, then run this again.');
} else {
  console.log('Chats that messaged your bot (use the number as TELEGRAM_CHAT_ID):');
  for (const [id, label] of chats) console.log(`  ${id}  (${label})`);
}
