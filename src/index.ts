import { Client, GatewayIntentBits, ChannelType, REST, Routes, SnowflakeUtil } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content !== '!usage-report') return;

  const guild = message.guild;
  if (!guild) return;

  const days = 7;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const rest = new REST().setToken(token);
  const channelCounts: Record<string, number> = {};

  const channels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);

  for (const channel of channels.values()) {
    try {
      const messages = await rest.get(Routes.channelMessages(channel.id), {
        query: {
          limit: '100',
          after: SnowflakeUtil.timestampTo(since).toString(),
        },
      });

      const msgArray = messages as unknown as Array<{ id: string; created_timestamp: string }>;
      const count = msgArray.filter((m) => new Date(m.created_timestamp).getTime() >= since).length;
      if (count > 0) {
        channelCounts[channel.name] = count;
      }
    } catch (error) {
      console.error(`Error fetching messages for channel ${channel.name}:`, error);
    }
  }

  const sorted = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);
  const topChannels = sorted.slice(0, 10);

  let report = `**Message Usage Report (Last ${days} Days)**\n`;
  if (topChannels.length === 0) {
    report += 'No messages found in the specified period.';
  } else {
    topChannels.forEach(([name, count], index) => {
      report += `${index + 1}. #${name}: ${count} messages\n`;
    });
  }

  await message.reply(report);
});

client.login(token);
