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

`time` is optional and defaults to 18:00. Dates/times are interpreted in
the **bot server's local timezone** — if you deploy across timezones,
consider pinning the host's `TZ` env var or extending `index.js`'s
`parseDate` to accept an explicit UTC offset.

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
