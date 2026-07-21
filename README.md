# Discord Event Signup Bot

Slash command `/event` that posts an announcement, spins up a thread,
and manages signups entirely through reactions:

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
5. Install dependencies:
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
  message — that's the thread. Click it to view/react to the list.
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

Events are stored in `events.json` next to the code (created automatically).
On restart, the bot re-reads this file and re-schedules any pending
"day before" reminders, so in-flight events survive a bot restart or deploy.

## Notes / things you may want to extend

- Discord only allows one reaction of a given emoji per user, so a user
  can only ever bring one "+1" through the ➕ button (not multiple guests).
- If a user reacts 🙋 and later reacts ➕ too, they'll take **two** spots
  (one as themselves, one as their +1) — that's intentional, but easy to
  change in `addSignup` if you'd rather cap it at one per user.
- Watcher DMs fail silently if the user has DMs closed.
