# Discord Event Signup Bot

Slash command `/event` that posts an announcement (with the 🙋/➕/👀
legend right underneath it — that's where you react) and spins up a
thread holding a live, read-only roster:

- 🙋 raise hand — join the list (or the waitlist if it's full)
- ➕ plus — claim a spot for "yourself +1" (a guest not on Discord)
- 👀 eye — get DM'd when a spot opens up, and again the day before the event
- Removing any reaction undoes that action and, for 🙋/➕, promotes the
  next waitlisted person into the freed spot automatically.

Spot #1 is always the event creator and isn't touched by reactions.

## Setup

1. Create an application + bot at https://discord.com/developers/applications,
   copy the **bot token** and the **application (client) ID**.
2. Under **Bot**, enable no privileged intents are required for this bot
   (it only needs reactions + basic guild message access).
3. Invite the bot to your server with the `bot` and `applications.commands`
   scopes, and permissions: Send Messages, Create Public Threads, Send
   Messages in Threads, Add Reactions, Read Message History.
4. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID`.
   Set `GUILD_ID` too while developing — guild-scoped commands register
   instantly, global ones can take up to an hour.
5. Install dependencies (requires **Node 22.5 or newer** — the storage
   layer uses the built-in `node:sqlite` module, no compiler needed):
   ```
   npm install
   ```
6. Register the slash command:
   ```
   npm run deploy
   ```
7. Start the bot:
   ```
   npm start
   ```

## Usage

```
/event spots:5 name:"Board game night" date:2026-08-15 time:18:00
```

`date` accepts either `YYYY-MM-DD` (e.g. `2026-08-15`) or US-style
`M-D-YY` / `M-D-YYYY` (e.g. `8-15-26`, `8/15/2026`) — slashes or dashes
both work. `time` accepts 24h (`18:00`) or 12h (`6pm`, `6:00pm`) and
defaults to 6:00pm if omitted. Dates/times are interpreted in the **bot
server's local timezone** — if you deploy across timezones, consider
pinning the host's `TZ` env var.

## If the thread doesn't show up

The bot now replies with a clear error instead of failing silently, but a
couple of things trip people up:

- **Discord doesn't auto-open the thread for anyone.** After `/event`
  runs, look for a small "🧵 N replies" link under the announcement
  message — that's the thread. Click it to see who's currently signed
  up. Reactions go on the announcement message itself, not on anything
  inside the thread.
  Nothing pops open automatically, on your client or anyone else's.
- **You can't create a thread from inside a thread.** Run `/event` in a
  normal text channel, not inside an existing thread — the bot will now
  tell you this directly if you try.
- **Missing permissions.** The bot checks for View Channel, Send
  Messages, Create Public Threads, Send Messages in Threads, Add
  Reactions, and Read Message History in the channel you run the command
  in, and will tell you exactly which ones are missing rather than
  failing quietly. Channel-specific permission overwrites can block the
  bot even if its role has the permission server-wide, so check both.

## Persistence

Events are stored in a local SQLite database, using Node's built-in
`node:sqlite` module (no native dependency to install or compile — it
ships with Node itself, requires **Node 22.5+**), so signups and the
waitlist survive a bot restart or redeploy — as long as the database
file itself lives on storage that survives too.

By default the database lives at `./data/events.db`, which is fine for
local development. **In production, most PaaS platforms wipe the local
filesystem on every redeploy or restart** — you need to point `DB_PATH`
at a persistent volume, not the app's own ephemeral disk.

**Fly.io:** already configured for you — see [Deploying to Fly.io](#deploying-to-flyio)
below, which creates and mounts the volume as part of setup.

**Railway:**
Add a Volume to your service (Settings → Volumes → New Volume), mount it
at e.g. `/data`, then set the `DB_PATH` environment variable to
`/data/events.db` in your service's Variables tab.

Without a mounted volume, the database resets to empty on every deploy —
the bot will still run, it'll just forget every event each time you push
a new version.

## Deploying to Fly.io

The repo includes a `Dockerfile` and `fly.toml` set up specifically for
this bot: no exposed HTTP port (it only opens an outbound connection to
Discord's gateway), and a mounted volume for the SQLite database so data
survives restarts and redeploys.

1. **Install the Fly CLI** and log in:
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Create the app** (from the project root). Pick a globally-unique
   name — this also updates `app = "..."` at the top of `fly.toml`:
   ```bash
   fly launch --name your-app-name-here --no-deploy
   ```
   When prompted, say **no** to adding a Postgres or Redis database (this
   bot doesn't use one), and **no** to a dedicated IPv4 (not needed — the
   bot doesn't accept inbound traffic). If it offers to overwrite the
   included `fly.toml`, decline — the one in this repo is already tuned
   for a non-HTTP worker.

3. **Create and mount the volume** for the SQLite database. Match the
   region you picked in step 2:
   ```bash
   fly volumes create event_bot_data --region iad --size 1
   ```
   (1 GB is far more than this bot needs.) The mount itself is already
   declared in `fly.toml` — pointing `/data` at this volume — so nothing
   else to configure there.

4. **Set your secrets** — never put these in `fly.toml` or commit them:
   ```bash
   fly secrets set DISCORD_TOKEN=your-bot-token-here
   fly secrets set CLIENT_ID=your-application-client-id-here
   fly secrets set DB_PATH=/data/events.db
   ```
   Leave `GUILD_ID` unset in production so the slash command registers
   globally (guild-scoped commands are just for fast iteration while
   developing).

5. **Deploy:**
   ```bash
   fly deploy
   ```

6. **Register the slash command** against production. Run this locally
   with your production `DISCORD_TOKEN`/`CLIENT_ID` in `.env` (and
   `GUILD_ID` unset or empty, for a global command):
   ```bash
   npm run deploy
   ```
   Global commands can take up to an hour to show up everywhere; a
   guild-scoped one (with `GUILD_ID` set) appears instantly if you want
   to sanity-check it in a test server first.

7. **Check it's alive:**
   ```bash
   fly logs
   ```
   You should see `Logged in as YourBotName#1234`.

To ship a code change later, just `fly deploy` again — the volume (and
your event data on it) persists across deploys.

## Notes / things you may want to extend

- Discord only allows one reaction of a given emoji per user, so a user
  can only ever bring one "+1" through the ➕ button (not multiple guests).
- If a user reacts 🙋 and later reacts ➕ too, they'll take **two** spots
  (one as themselves, one as their +1) — that's intentional, but easy to
  change in `addSignup` if you'd rather cap it at one per user.
- Watcher DMs fail silently if the user has DMs closed.
