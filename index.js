import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
} from 'discord.js';
import { store } from './storage.js';
import {
  EMOJI,
  createEvent,
  buildListContent,
  addSignup,
  removeSignup,
  addWatcher,
  removeWatcher,
  notifyWatchers,
  statusMessage,
  scheduleReminder,
  rescheduleAllReminders,
} from './eventManager.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

// ---------- helpers ----------

function parseDate(dateStr, timeStr) {
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '18:00';
  const d = new Date(`${dateStr}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function editListMessage(thread, event) {
  const msg = await thread.messages.fetch(event.messageId);
  await msg.edit(buildListContent(event));
  return msg;
}

// ---------- slash command ----------

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'event') return;

  const spots = interaction.options.getInteger('spots', true);
  const eventName = interaction.options.getString('name', true);
  const dateStr = interaction.options.getString('date', true);
  const timeStr = interaction.options.getString('time', false);

  const date = parseDate(dateStr, timeStr);
  if (!date) {
    await interaction.reply({
      content: 'That date/time didn\'t parse. Use a date like `2026-08-15` and time like `18:00`.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply(
    `Looking for **${spots}** people for **${eventName}** on <t:${Math.floor(date.getTime() / 1000)}:D>.`
  );
  const announcement = await interaction.fetchReply();

  const thread = await announcement.startThread({
    name: `${eventName} — signups`,
    autoArchiveDuration: 1440,
  });

  const listMessage = await thread.send('Setting up the list...');

  const event = createEvent({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    threadId: thread.id,
    messageId: listMessage.id,
    creatorId: interaction.user.id,
    eventName,
    dateISO: date.toISOString(),
    spots,
  });

  await listMessage.edit(buildListContent(event));
  for (const emoji of [EMOJI.RAISE_HAND, EMOJI.PLUS, EMOJI.EYE]) {
    await listMessage.react(emoji);
  }

  scheduleReminder(client, event);
});

// ---------- reaction handling ----------

async function resolveReaction(reaction, user) {
  if (user.bot) return null;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return null;
    }
  }
  const event = store.get(reaction.message.id);
  if (!event) return null;
  return event;
}

client.on('messageReactionAdd', async (reaction, user) => {
  const event = await resolveReaction(reaction, user);
  if (!event) return;

  const thread = await client.channels.fetch(event.threadId);
  const emojiName = reaction.emoji.name;

  if (emojiName === EMOJI.RAISE_HAND) {
    const updated = addSignup(event, user.id, 'member');
    await editListMessage(thread, updated);
  } else if (emojiName === EMOJI.PLUS) {
    const updated = addSignup(event, user.id, 'plus');
    await editListMessage(thread, updated);
  } else if (emojiName === EMOJI.EYE) {
    const updated = addWatcher(event, user.id);
    await editListMessage(thread, updated);
    try {
      await user.send(statusMessage(updated));
    } catch {
      // DMs closed — ignore.
    }
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  const event = await resolveReaction(reaction, user);
  if (!event) return;

  const thread = await client.channels.fetch(event.threadId);
  const emojiName = reaction.emoji.name;

  if (emojiName === EMOJI.RAISE_HAND || emojiName === EMOJI.PLUS) {
    const type = emojiName === EMOJI.RAISE_HAND ? 'member' : 'plus';
    const { event: updated, openedSlot } = removeSignup(event, user.id, type);
    await editListMessage(thread, updated);
    if (openedSlot) {
      await notifyWatchers(client, updated, statusMessage(updated));
    }
  } else if (emojiName === EMOJI.EYE) {
    const updated = removeWatcher(event, user.id);
    await editListMessage(thread, updated);
  }
});

// ---------- boot ----------

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  rescheduleAllReminders(client);
});

client.login(process.env.DISCORD_TOKEN);
