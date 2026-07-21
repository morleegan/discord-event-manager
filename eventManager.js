import schedule from 'node-schedule';
import { store } from './storage.js';

export const EMOJI = {
  RAISE_HAND: '🙋',
  PLUS: '➕',
  EYE: '👀',
};

// Jobs are re-created on boot from storage, so keep them out of the
// persisted event object itself.
const reminderJobs = new Map(); // messageId -> scheduled job

/**
 * Shape of a stored event:
 * {
 *   guildId, channelId, threadId, messageId,
 *   creatorId, eventName, dateISO,
 *   spots: number,
 *   participants: Array<null | { userId, type: 'member' | 'plus', ownerId }>,
 *   waitlist: Array<{ userId, type: 'member' | 'plus', ownerId }>,
 *   watchers: string[],
 * }
 */

export function createEvent({
  guildId,
  channelId,
  threadId,
  messageId,
  creatorId,
  eventName,
  dateISO,
  spots,
}) {
  const participants = new Array(spots).fill(null);
  participants[0] = { userId: creatorId, type: 'member', ownerId: creatorId };

  const event = {
    guildId,
    channelId,
    threadId,
    messageId,
    creatorId,
    eventName,
    dateISO,
    spots,
    participants,
    waitlist: [],
    watchers: [],
  };

  store.set(messageId, event);
  return event;
}

function label(entry) {
  if (!entry) return '_open_';
  if (entry.type === 'plus') return `<@${entry.ownerId}> +1`;
  return `<@${entry.userId}>`;
}

const LEGEND = [
  `${EMOJI.RAISE_HAND} — grab a spot (or the waitlist, if it's full)`,
  `${EMOJI.PLUS} — bring a +1 (a guest not on Discord)`,
  `${EMOJI.EYE} — get DMed if a spot opens, or the day before the event`,
].join('\n');

/**
 * The top-level announcement message posted in the channel. Kept
 * separate from the numbered list (which lives in the thread) so the
 * emoji legend is visible without anyone having to open the thread.
 */
export function buildAnnouncementContent({ eventName, spots, date }) {
  const dateDisplay = `<t:${Math.floor(date.getTime() / 1000)}:F>`;
  return [
    `🦆 **${eventName}** — ${dateDisplay}`,
    `Looking for **${spots}** people. Head into the thread below to grab a spot!`,
    '',
    LEGEND,
    '',
    `_(React on the numbered list inside the thread, not on this message.)_`,
  ].join('\n');
}

export function buildListContent(event) {
  const dateDisplay = `<t:${Math.floor(new Date(event.dateISO).getTime() / 1000)}:F>`;
  const lines = [
    `**${event.eventName}** — ${dateDisplay}`,
    '',
    LEGEND,
    '',
  ];

  event.participants.forEach((entry, i) => {
    lines.push(`${i + 1}. ${label(entry)}`);
  });

  if (event.waitlist.length > 0) {
    lines.push('', '**Waitlist:**');
    event.waitlist.forEach((entry, i) => {
      lines.push(`${i + 1}. ${label(entry)}`);
    });
  }

  return lines.join('\n');
}

function findParticipantIndex(event, userId) {
  return event.participants.findIndex((e) => e && e.userId === userId);
}

function findWaitlistIndex(event, userId) {
  return event.waitlist.findIndex((e) => e.userId === userId);
}

function isAlreadyIn(event, userId) {
  return findParticipantIndex(event, userId) !== -1 || findWaitlistIndex(event, userId) !== -1;
}

function firstOpenSlot(event) {
  // Slot 0 is always the creator's — reactions never touch it.
  for (let i = 1; i < event.participants.length; i++) {
    if (event.participants[i] === null) return i;
  }
  return -1;
}

/**
 * Adds someone to the list (as themself, or as a +1 owned by them).
 * Returns { event, openedNone: boolean } — used by caller to decide
 * whether to notify watchers (no notification needed on a join, only
 * on an opening, but we still return the updated event for editing).
 */
export function addSignup(event, userId, type) {
  const entryUserKey = type === 'plus' ? `plus:${userId}` : userId;
  const alreadyInAsThisType = [...event.participants, ...event.waitlist].some(
    (e) => e && e.type === type && (type === 'plus' ? e.ownerId === userId : e.userId === userId)
  );
  if (alreadyInAsThisType) return event;

  const entry =
    type === 'plus'
      ? { userId: entryUserKey, type: 'plus', ownerId: userId }
      : { userId, type: 'member', ownerId: userId };

  const slot = firstOpenSlot(event);
  if (slot !== -1) {
    event.participants[slot] = entry;
  } else {
    event.waitlist.push(entry);
  }

  store.set(event.messageId, event);
  return event;
}

/**
 * Removes someone (their own signup, or their +1) from participants
 * or waitlist, promoting the next waitlisted person into any freed
 * slot. Returns { event, openedSlot: boolean } so the caller knows
 * whether to notify watchers of a genuine opening.
 */
export function removeSignup(event, userId, type) {
  const matches = (e) =>
    e && e.type === type && (type === 'plus' ? e.ownerId === userId : e.userId === userId);

  const pIndex = event.participants.findIndex(matches);
  let openedSlot = false;

  if (pIndex !== -1) {
    event.participants[pIndex] = null;
    if (event.waitlist.length > 0) {
      event.participants[pIndex] = event.waitlist.shift();
    } else {
      openedSlot = true;
    }
  } else {
    const wIndex = event.waitlist.findIndex(matches);
    if (wIndex !== -1) event.waitlist.splice(wIndex, 1);
  }

  store.set(event.messageId, event);
  return { event, openedSlot };
}

export function addWatcher(event, userId) {
  if (!event.watchers.includes(userId)) {
    event.watchers.push(userId);
    store.set(event.messageId, event);
  }
  return event;
}

export function removeWatcher(event, userId) {
  event.watchers = event.watchers.filter((id) => id !== userId);
  store.set(event.messageId, event);
  return event;
}

export function openSlotCount(event) {
  return event.participants.filter((e) => e === null).length;
}

export function statusMessage(event) {
  const open = openSlotCount(event);
  const dateDisplay = `<t:${Math.floor(new Date(event.dateISO).getTime() / 1000)}:F>`;
  return open > 0
    ? `👀 Update on **${event.eventName}** (${dateDisplay}): ${open} spot${open === 1 ? '' : 's'} just opened up!`
    : `👀 Reminder: **${event.eventName}** is happening ${dateDisplay}. The list is currently full.`;
}

export async function notifyWatchers(client, event, message) {
  for (const userId of event.watchers) {
    try {
      const user = await client.users.fetch(userId);
      await user.send(message);
    } catch {
      // User has DMs closed or is unreachable — skip silently.
    }
  }
}

/**
 * Schedules a day-before reminder DM to all watchers. Safe to call
 * repeatedly (e.g. on every bot boot) since it clears any existing
 * job for the event first.
 */
export function scheduleReminder(client, event) {
  const existing = reminderJobs.get(event.messageId);
  if (existing) existing.cancel();

  const reminderTime = new Date(new Date(event.dateISO).getTime() - 24 * 60 * 60 * 1000);
  if (reminderTime.getTime() <= Date.now()) return; // already past, don't schedule

  const job = schedule.scheduleJob(reminderTime, async () => {
    const latest = store.get(event.messageId);
    if (!latest) return;
    await notifyWatchers(client, latest, statusMessage(latest));
  });

  reminderJobs.set(event.messageId, job);
}

export function rescheduleAllReminders(client) {
  const all = store.all();
  for (const event of Object.values(all)) {
    scheduleReminder(client, event);
  }
}
