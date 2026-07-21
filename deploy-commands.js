import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const command = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Create a signup event with a thread and reaction-based list')
  .addIntegerOption((opt) =>
    opt.setName('spots').setDescription('How many people you need').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt.setName('name').setDescription('Event name').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('date')
      .setDescription('Date, e.g. 2026-08-15')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('time')
      .setDescription('Time in 24h HH:mm, e.g. 18:00 (defaults to 18:00)')
      .setRequired(false)
  )
  .toJSON();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function main() {
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);

  await rest.put(route, { body: [command] });
  console.log(
    `Registered /event command ${process.env.GUILD_ID ? '(guild, instant)' : '(global, up to 1hr to propagate)'}`
  );
}

main().catch(console.error);
