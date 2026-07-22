import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';
import { store } from './storage.js';
import {
  EMOJI,
  createEvent,
  buildAnnouncementContent,
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
import { parseEventDateTime } from './dateParser.js';

const REQUIRED_PERMS = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.CreatePublicThreads,
  PermissionsBitField.Flags.SendMessagesInThreads,
  PermissionsBitField.Flags.AddReactions,
  PermissionsBitField.Flags.ReadMessageHistory,
];

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

async function editListMessage(thread, event) {
  const msg = await thread.messages.fetch(event.listMessageId);
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
  const location = interaction.options.getString('location', false);
  const quiet = interaction.options.getBoolean('quiet', false) ?? false;

  const parsed = parseEventDateTime(dateStr, timeStr);
  if (parsed.error) {
    await interaction.reply({ content: parsed.error, flags: MessageFlags.Ephemeral });
    return;
  }
  const { date } = parsed;

  // interaction.channel can be null if the channel wasn't already in
  // the client's cache when the interaction arrived (common right
  // after bot startup) — fetch it explicitly rather than trusting it.
  // Note: fetch() throws rather than returning null/undefined if the
  // bot lacks access (e.g. DiscordAPIError 50001 "Missing Access"), so
  // this has to be try/caught, not just null-checked.
  let channel = interaction.channel;
  if (!channel) {
    try {
      channel = await interaction.client.channels.fetch(interaction.channelId);
    } catch (err) {
      console.error('Failed to fetch channel for /event:', err);
      const reason =
        err?.code === 50001
          ? "I don't have permission to view this channel — check that my role (or a channel-specific permission overwrite) grants me View Channel here."
          : "I couldn't load this channel — try again in a moment, or ping the bot owner if this keeps happening.";
      await interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
      return;
    }
  }
  if (!channel) {
    await interaction.reply({
      content: "I couldn't find this channel — try again in a moment, or ping the bot owner if this keeps happening.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Discord doesn't allow creating a thread from a message inside
  // another thread — catch this early with a clear message instead
  // of a confusing silent failure.
  if (channel.isThread()) {
    await interaction.reply({
      content:
        "I can't open a thread from inside a thread — run `/event` in a regular text channel instead.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const me = interaction.guild.members.me;
  const missing = channel.permissionsFor(me)?.missing(REQUIRED_PERMS) ?? REQUIRED_PERMS;
  if (missing.length > 0) {
    await interaction.reply({
      content: `I'm missing permissions in this channel to do that: **${missing.join(', ')}**. Ask a server admin to grant them (or re-invite me with the right permissions), then try again.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await interaction.reply(buildAnnouncementContent({ eventName, spots, date, location, quiet }));
    const announcement = await interaction.fetchReply();

    // Reactions live on the announcement itself now, not on a message
    // inside the thread — react here before anything else so the
    // buttons are visible right away.
    for (const emoji of [EMOJI.RAISE_HAND, EMOJI.PLUS, EMOJI.EYE]) {
      await announcement.react(emoji);
    }

    // Deliberately NOT using announcement.startThread() here: right
    // after an interaction reply, the message's channel can fail the
    // client's internal cache lookup (DiscordjsError: ChannelNotCached)
    // even though the channel object fetched above is perfectly valid.
    // Creating the thread from that channel object sidesteps that.
    const thread = await channel.threads.create({
      name: `${eventName} — signups`,
      autoArchiveDuration: 1440,
      startMessage: announcement.id,
    });

    const listMessage = await thread.send('Setting up the roster...');

    const event = createEvent({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      threadId: thread.id,
      messageId: announcement.id,
      listMessageId: listMessage.id,
      creatorId: interaction.user.id,
      eventName,
      dateISO: date.toISOString(),
      spots,
      location,
      quiet,
    });

    await listMessage.edit(buildListContent(event));

    scheduleReminder(client, event);
  } catch (err) {
    console.error('Failed to set up event thread:', err);
    // Surface the failure instead of leaving the user staring at a
    // post with no thread and no explanation.
    const message =
      "Something went wrong creating the thread or list — check that I have permission to create threads and post in them here. (See the bot's console log for details.)";
    if (interaction.replied) {
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
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

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  rescheduleAllReminders(client);
});

client.login(process.env.DISCORD_TOKEN);
