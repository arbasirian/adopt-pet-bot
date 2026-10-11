# adopt-pet-bot 🐶

Watches [Verhuisdieren](https://verhuisdieren.nl) for newly listed **Golden Retrievers** and
**Berner Sennen / Bernese Mountain Dogs** that are up for adoption, and sends a Telegram message
when a new one appears. It runs on GitHub Actions every 5 minutes, so there is no server to run.

## How it works

1. Calls the Verhuisdieren JSON API directly (no HTML scraping):
   `https://api.verhuisdieren.nl/api/profile/animals?filters[animalType]=Hond&filters[hideReserved]=false&filters[type]=adopt&page=N`
2. Keeps dogs whose `race` matches one of the breeds (see [Breed matching](#breed-matching)).
3. Any matching dog whose `id` is not in `state/seen.json` gets a Telegram alert: photo, name,
   breed, age, city, reserved status and published date, plus a **View listing** button.
4. Alerted IDs are added to `state/seen.json`, and the workflow commits the file back to the repo.

Listings come back newest first, 24 per page. A normal run checks the first 3 pages (72 dogs,
about 2 to 3 days of new listings), which is far more than ever appears in 5 minutes.

### State: why a JSON file committed to the repo

The seen IDs live in `state/seen.json` in this repository. After each run, the workflow commits
the file, but only if it changed. That means a commit only happens when a new matching dog shows up.

I chose this over the alternatives because:

- **Reliable.** Git doesn't expire anything. The Actions cache gets evicted after 7 days without
  use, and artifacts expire too. Losing the state would mean resending old listings.
- **Visible.** You can open the file on GitHub, and the commit history doubles as a log of every alert.
- **No extra services.** No database, gist or token to manage. The workflow's built-in
  `GITHUB_TOKEN` (with `contents: write`) is all it needs.
- **Safe.** The file holds only public listing IDs, never secrets.

Safety measures:

- **First run = baseline.** When `state/seen.json` doesn't exist, the bot scans **all** pages and
  records every matching dog that is currently listed **without alerting on them**. It sends one
  "bot is running" message so you know Telegram works. After that, only dogs listed later trigger alerts.
- **API/network failures don't touch state.** Each request has a timeout and 3 attempts. If the API
  still fails, or returns something unexpected, the run logs a warning and exits without changing
  anything. A broken response is never read as "no dogs listed".
- **A corrupt state file stops the bot** with an error. It does not re-baseline or resend everything.
- **An ID is marked as seen only after Telegram accepts the message.** A failed send is retried on the
  next run, and alerts that went through in the same run are still saved, because the commit step uses `if: always()`.
- **One run at a time.** A `concurrency` group stops overlapping runs from sending the same alert twice.
- **Atomic writes.** The state file is written to a temp file and then renamed.

To **re-baseline**, delete `state/seen.json` and commit. To **get an alert for one dog again**,
remove its ID from the file.

### Breed matching

Before matching, the `race` field is lowercased and stripped of everything except letters. A dog
matches if the result contains any of:

| Pattern              | Matches e.g.                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `goldenretriever`    | Golden Retriever, Golden Retriever Mix, Labrador/ golden retriever  |
| `bernersenn`         | Berner Sennen, Berner Sennen Hond, Bernersennen, Mechelaar x bernersenner |
| `bennersenn`         | Benner Sennen (a typo in a real listing)                            |
| `bernesemountaindog` | Bernese Mountain Dog                                                |

These spellings come from real listings. There is no bare `golden` pattern, so Goldendoodle,
Golden doodle and similar don't match. The patterns are in `src/match.ts`, and the examples are
covered by `src/match.test.ts`.

## Setup in GitHub

1. **Create a new bot token.** In Telegram, open [@BotFather](https://t.me/BotFather). Revoke the
   old, exposed token (`/revoke`), or create a new bot (`/newbot`), and copy the **new** token.
   Don't paste it into any file, chat or commit. It belongs only in GitHub Secrets.
2. **Send your bot a message.** Open your bot in Telegram and press **Start** or send "hi".
3. **Find your chat ID.** Either:
   - Run the helper locally. The token is read from a hidden prompt, so it isn't saved in your shell history:
     ```sh
     npm install
     read -s TELEGRAM_BOT_TOKEN && export TELEGRAM_BOT_TOKEN   # paste token, press Enter
     npm run chat-id
     unset TELEGRAM_BOT_TOKEN
     ```
   - Or open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find
     `"chat":{"id":123456789,...}`. For groups, the ID is negative, like `-100…`. Close the tab afterwards.
4. **Create the GitHub repo and push** this project to it (see "Public or private" below).
5. **Add the secrets.** Go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `TELEGRAM_BOT_TOKEN`: the new token
   - `TELEGRAM_CHAT_ID`: the number from step 3
6. **Check workflow permissions.** Under **Settings → Actions → General → Workflow permissions**, make sure
   "Read and write permissions" is allowed. The workflow asks for `contents: write`. Some organization
   policies cap this at read-only, and then the state commit fails.
7. **Run it once by hand.** Go to **Actions → "Check for new dogs" → Run workflow**. The first run
   creates the baseline, commits `state/seen.json`, and sends a ✅ "adopt-pet-bot is running" message.
   From then on, it runs every 5 minutes.

### Public or private repo?

- **Public repo (recommended).** GitHub Actions minutes are free and unlimited. Nothing sensitive is
  in the repo: secrets stay in GitHub Secrets, and the state is public listing IDs.
- **Private repo.** Each run is billed as at least 1 minute. Every 5 minutes, that's about **8,600
  minutes a month**, well over the 2,000 free minutes on a Free plan. If the repo is private, change
  the cron in `.github/workflows/check-dogs.yml` to every 30 minutes (`*/30 * * * *`) or slower.

### Good to know

- GitHub runs scheduled workflows on a best-effort basis. Under load, runs can be 5 to 15 minutes
  late, and some are skipped.
- In public repos, GitHub **disables scheduled workflows after 60 days with no repository
  activity**. The bot's own commits count as activity, but if no new dogs appear for 2 months,
  GitHub emails you. Click "Enable workflow" in the Actions tab, or push any commit.
- If the API is down, the run logs a warning and still shows as successful, so you don't get a
  failure email every 5 minutes. A Telegram failure or a bad configuration makes the run fail.

## Local development

You need Node.js 22.6 or later. There are no runtime dependencies: Node runs the TypeScript files
directly. TypeScript is only a dev dependency, used for type checking.

```sh
npm install            # dev tools only (typescript, @types/node)
npm run typecheck      # tsc, no emit
npm test               # breed-matching tests
npm run dry-run        # real API, prints alerts instead of sending, never writes state after baseline
```

Environment variables:

| Variable             | Default            | Purpose                                         |
| -------------------- | ------------------ | ----------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | required           | Bot token (GitHub secret)                       |
| `TELEGRAM_CHAT_ID`   | required           | Where alerts go (GitHub secret)                 |
| `DRY_RUN`            | off                | `1` = don't need or use Telegram; log instead   |
| `STATE_FILE`         | `state/seen.json`  | Use a different path, e.g. for local testing    |
| `PAGES_PER_RUN`      | `3`                | API pages checked on normal (non-baseline) runs |

> Note: a local dry run with no state file creates `state/seen.json`. Delete it before you push,
> so the first GitHub run creates the real baseline. Or use `STATE_FILE=/tmp/seen.json npm run dry-run`.

## Project layout

```
.github/workflows/check-dogs.yml   cron + manual trigger, commits state
src/index.ts                       main flow: baseline / diff / alert / save
src/verhuisdieren.ts               API client (timeouts, retries, response validation)
src/match.ts                       breed matching
src/telegram.ts                    message formatting + Telegram Bot API calls
src/state.ts                       load/save state/seen.json
src/get-chat-id.ts                 helper: list chat IDs via getUpdates
state/seen.json                    created by the first run
```
