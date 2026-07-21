/**
 * Parses a date string in any of these forms:
 *   - ISO / year-first:  2026-07-16   or  2026/07/16
 *   - US month-first:    7-16-26      or  7/16/2026   or  07-16-26
 *
 * Year-first is detected by a leading 4-digit group; anything else is
 * treated as month-day-year (US convention), matching what most people
 * type without thinking about it. 2-digit years are assumed 20xx.
 *
 * Returns { year, month, day } (month is 1-12) or null if it doesn't
 * match a supported shape at all. Does NOT validate that the date is
 * real (e.g. Feb 30) — that's checked later via a Date round-trip.
 */
export function parseDateInput(input) {
  const s = input.trim();

  // Year-first: 2026-07-16 or 2026/07/16
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return { year: Number(y), month: Number(mo), day: Number(d) };
  }

  // Month-first: 7-16-26, 7/16/2026, 07-16-26, etc.
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (m) {
    const [, mo, d, yRaw] = m;
    let year = Number(yRaw);
    if (yRaw.length === 2) year += 2000;
    return { year, month: Number(mo), day: Number(d) };
  }

  return null;
}

/**
 * Parses a time string like "18:00", "6:00pm", "6pm", "6:30 AM".
 * Defaults to 18:00 if no input is given at all.
 * Returns { hour, minute } (24h) or null if unparseable.
 */
export function parseTimeInput(input) {
  if (!input) return { hour: 18, minute: 0 };

  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ampm = m[3];

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  }

  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Combines date + time parsing into a single validated Date object
 * (interpreted in the bot host's local timezone — see README).
 * Returns { date } on success or { error: string } with a
 * user-friendly message on failure.
 */
export function parseEventDateTime(dateStr, timeStr) {
  const dateParts = parseDateInput(dateStr);
  if (!dateParts) {
    return {
      error: `I couldn't understand the date "${dateStr}". Try formats like \`2026-07-16\` or \`7-16-26\`.`,
    };
  }

  const timeParts = parseTimeInput(timeStr);
  if (!timeParts) {
    return {
      error: `I couldn't understand the time "${timeStr}". Try formats like \`18:00\` or \`6:00pm\`.`,
    };
  }

  const { year, month, day } = dateParts;
  const { hour, minute } = timeParts;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  // Round-trip check catches invalid combos like month 13 or Feb 30,
  // which the Date constructor would otherwise silently roll over.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { error: `"${dateStr}" doesn't look like a real date.` };
  }

  return { date };
}
