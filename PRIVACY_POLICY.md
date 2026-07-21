# Privacy Policy

**Last updated:** July 21, 2026

This bot ("the Bot") is open-source software built to help friends organize
events — game nights, meetups, whatever. This policy explains what data it
touches and why, so there are no surprises.

## Who this applies to

The Bot's code is public and anyone can run their own copy of it. This
policy describes how the *official code* behaves. If you're using an
instance of this Bot hosted by someone else (a friend, a community server
admin), **that person or organization is the one responsible for the data
their instance stores** — they're running their own copy of open-source
software, not a service operated by the original author. Ask your server's
admin who's hosting the instance if you're unsure.

## What data the Bot collects

To do its job (creating events, tracking signups, sending reminders), the
Bot stores:

- **Discord IDs** — server, channel, thread, and message IDs, so it knows
  where an event lives.
- **User IDs** — of the event creator, everyone who signs up (🙋), anyone
  who adds a "+1" (➕), and anyone who watches for openings (👀). Discord
  user IDs are just numbers; the Bot doesn't separately store usernames,
  emails, or any other Discord profile data.
- **Event details you type** — the event name, date, time, and number of
  spots, exactly as entered in the `/event` command.

The Bot does **not** read or store the content of regular messages. It
only sees what's needed to run the `/event` command and to track reactions
on the messages it posts.

## Why it's collected

Purely to make the feature work: building the numbered signup list,
maintaining the waitlist, and sending you a DM if you've reacted 👀 and a
spot opens up or the event is coming up the next day.

## Where it's stored and for how long

Data is stored locally by whoever is hosting that instance of the Bot (in
a simple local file, by default) — it isn't sent to any third party or
analytics service. Event data is kept only as long as it's useful for
running that event; hosts are free to delete old event data at any time,
and you can always ask a server admin to remove your data from their
instance.

## Direct messages

The Bot will only DM you if you've opted in by reacting 👀 to an event's
signup list. You can stop these at any time by removing that reaction.

## Your choices

- Don't want to be on a list? Remove your 🙋/➕ reaction and you're taken
  off (and the next waitlisted person gets your spot).
- Don't want reminder DMs? Remove your 👀 reaction.
- Want your data gone entirely? Ask the admin of the server hosting the
  Bot — since data lives in their instance, they can remove it.

## Changes

Since this is open-source, the policy for the official code may be updated
here as the project evolves. Anyone hosting their own instance should keep
their own copy up to date if they modify how the Bot handles data.

## Questions

Open an issue on the project's GitHub repository — link is in the repo
README.
