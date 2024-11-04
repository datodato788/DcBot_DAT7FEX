require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
const channelSettingsPath = './channelSettings.json';
let channelSettings = {};

// Load the channelSettings.json data without overwriting
if (fs.existsSync(channelSettingsPath)) {
    try {
        channelSettings = JSON.parse(fs.readFileSync(channelSettingsPath, 'utf8'));
    } catch (error) {
        console.error("Error reading JSON file:", error);
    }
}

function saveChannelSettings() {
    // Sort keys and write to file only if data has changed
    const orderedSettings = Object.keys(channelSettings)
        .sort()
        .reduce((obj, key) => {
            const guildSettings = channelSettings[key];
            obj[key] = {
                serverName: guildSettings.serverName || "Server name undefined",
                settings: {
                    welcomeChannel: guildSettings.welcomeChannel || "Not set",
                    messageLogChannel: guildSettings.messageLogChannel || "Not set",
                    generalLogChannel: guildSettings.generalLogChannel || "Not set",
                    infoChannel: guildSettings.infoChannel || "Not set",
                }
            };
            return obj;
        }, {});
    
    try {
        fs.writeFileSync(channelSettingsPath, JSON.stringify(orderedSettings, null, 4));
    } catch (error) {
        console.error("Error saving JSON file:", error);
    }
}

const commands = [
    {
        name: 'setwelcome',
        description: 'Select a channel for welcome messages.',
        options: [
            {
                name: 'channel',
                type: 7,
                description: 'Channel for welcome messages',
                required: true,
            },
        ],
    },
    {
        name: 'delwelcome',
        description: 'Delete the welcome channel setting.'
    },
    {
        name: 'set_log_message',
        description: 'Select a channel for message logging.',
        options: [
            {
                name: 'channel',
                type: 7,
                description: 'Channel for message logging',
                required: true,
            },
        ],
    },
    {
        name: 'del_log_message',
        description: 'Delete the message log channel setting.'
    },
    {
        name: 'set_log',
        description: 'Select a channel for general logs.',
        options: [
            {
                name: 'channel',
                type: 7,
                description: 'Channel for general logs',
                required: true,
            },
        ],
    },
    {
        name: 'del_log',
        description: 'Delete the general log channel setting.'
    },
    {
        name: 'mdelete',
        description: 'Delete a specified number of messages',
        options: [
            {
                name: 'count',
                type: 4,
                description: 'Number of messages to delete',
                required: true,
            },
        ],
    },
    {
        name: 'ban',
        description: 'Ban a specified user',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'User to ban',
                required: true,
            },
        ],
    },
    {
        name: 'mute',
        description: 'Mute a specified user',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'User to mute',
                required: true,
            },
            {
                name: 'duration',
                type: 4,
                description: 'Duration in minutes',
                required: false,
            },
        ],
    },
    {
        name: 'finfo',
        description: 'Fetch user information',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'User for information',
                required: false,
            },
        ],
    },
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    client.guilds.cache.forEach(async (guild) => {
        // Only add guilds not present in settings
        if (!channelSettings[guild.id]) {
            channelSettings[guild.id] = { serverName: guild.name };
        }
        
        saveChannelSettings();

        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands },
            );
            console.log(`Slash commands successfully updated on server: ${guild.name}`);
        } catch (error) {
            console.error(`Failed to update commands on server: ${guild.name}`, error);
        }
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, guildId } = interaction;

    if (!channelSettings[guildId]) {
        channelSettings[guildId] = {};
    }

    if (commandName === 'setwelcome') {
        const channel = options.getChannel('channel');
        channelSettings[guildId].welcomeChannel = channel.id;
        saveChannelSettings();
        interaction.reply({ content: `Welcome channel set to: ${channel.name}`, ephemeral: true });
    } else if (commandName === 'delwelcome') {
        delete channelSettings[guildId].welcomeChannel;
        saveChannelSettings();
        interaction.reply({ content: `Welcome channel setting has been deleted.`, ephemeral: true });
    } else if (commandName === 'set_log_message') {
        const channel = options.getChannel('channel');
        channelSettings[guildId].messageLogChannel = channel.id;
        saveChannelSettings();
        interaction.reply({ content: `Message log channel set to: ${channel.name}`, ephemeral: true });
    } else if (commandName === 'del_log_message') {
        delete channelSettings[guildId].messageLogChannel;
        saveChannelSettings();
        interaction.reply({ content: `Message log channel setting has been deleted.`, ephemeral: true });
    } else if (commandName === 'set_log') {
        const channel = options.getChannel('channel');
        channelSettings[guildId].generalLogChannel = channel.id;
        saveChannelSettings();
        interaction.reply({ content: `General log channel set to: ${channel.name}`, ephemeral: true });
    } else if (commandName === 'del_log') {
        delete channelSettings[guildId].generalLogChannel;
        saveChannelSettings();
        interaction.reply({ content: `General log channel setting has been deleted.`, ephemeral: true });
    } else if (commandName === 'finfo') {
        const member = options.getMember('user') || interaction.member;
        const joinDate = member.joinedAt.toDateString();
        const roles = member.roles.cache.map(role => role.name).join(', ');

        const finfoChannel = interaction.guild.channels.cache.get(channelSettings[guildId].infoChannel);
        if (finfoChannel) {
            finfoChannel.send(`User: ${member.user.tag}\nJoined: ${joinDate}\nRoles: ${roles}`);
            interaction.reply({ content: 'Information sent to the specified channel.', ephemeral: true });
        } else {
            interaction.reply("Info channel not found.");
        }
    }
});

client.on('guildMemberAdd', member => {
    const welcomeChannelId = channelSettings[member.guild.id]?.welcomeChannel;
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x7289da)
            .setDescription(`🎉 Welcome, ${member.user.username}!`)
            .addFields(
                { name: "Server member count", value: `${member.guild.memberCount}`, inline: true }
            )
            .setTimestamp();

        welcomeChannel.send({ content: `${member.user}`, embeds: [welcomeEmbed] });
    } else {
        console.log("Welcome channel is not set.");
    }
});

client.on('messageCreate', message => {
    const logChannelId = channelSettings[message.guild.id]?.messageLogChannel;
    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (logChannel && !message.author.bot) {
        logChannel.send(`
        [${message.channel.name}]-[${message.author.tag}]: ${message.content}`);
    }
});

client.login(process.env.TOKEN);
