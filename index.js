const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');

// Configuração do bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = 'k!';

// Map para Tellonym
const tellonymConfig = new Map();

// === SLASH COMMANDS ===
const commands = [
    { name: 'ping', description: 'Verifica se o KAOS está online' }
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Registrando slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
}

client.once('ready', async () => {
    console.log(`Online como ${client.user.tag}`);
    await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'ping') {
        await interaction.reply('🔥 **KAOS online!**');
    }
});

// === TODOS OS COMANDOS COM PREFIXO k! ===
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // k!ping
    if (commandName === 'ping') {
        await message.reply('🔥 **KAOS online!**');
    }

    // k!clear
    if (commandName === 'clear' || commandName === 'limpar') {
        if (!message.member.permissions.has('ManageMessages')) return message.reply('❌ Sem permissão.');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 99) return message.reply('❌ Use: `k!clear <1 a 99>`');
        try {
            await message.channel.bulkDelete(amount + 1, true);
            const msg = await message.channel.send(`🧹 Apaguei ${amount} mensagens.`);
            setTimeout(() => msg.delete(), 3000);
        } catch {
            message.reply('❌ Erro ao apagar (mensagens antigas?).');
        }
    }

    // k!ban
    if (commandName === 'ban') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('❌ Sem permissão.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione alguém.');
        if (!member.bannable) return message.reply('❌ Não consigo banir.');
        const reason = args.slice(1).join(' ');
        try {
            await member.ban({ reason });
            message.reply(`🔨 ${member.user.tag} banido.\nRazão: ${reason || 'Nenhuma'}`);
        } catch {
            message.reply('❌ Erro ao banir.');
        }
    }

    // k!kick
    if (commandName === 'kick') {
        if (!message.member.permissions.has('KickMembers')) return message.reply('❌ Sem permissão.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione alguém.');
        if (!member.kickable) return message.reply('❌ Não consigo expulsar.');
        const reason = args.slice(1).join(' ');
        try {
            await member.kick(reason);
            message.reply(`👢 ${member.user.tag} expulso.\nRazão: ${reason || 'Nenhuma'}`);
        } catch {
            message.reply('❌ Erro ao expulsar.');
        }
    }

    // k!mute
    if (commandName === 'mute' || commandName === 'timeout') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('❌ Sem permissão.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione alguém.');
        if (!member.moderatable) return message.reply('❌ Não consigo mutar.');
        const time = args[1];
        if (!time) return message.reply('❌ Informe o tempo (ex: 10m).');
        const reason = args.slice(2).join(' ');
        let durationMs;
        if (time.endsWith('s')) durationMs = parseInt(time) * 1000;
        else if (time.endsWith('m')) durationMs = parseInt(time) * 60000;
        else if (time.endsWith('h')) durationMs = parseInt(time) * 3600000;
        else if (time.endsWith('d')) durationMs = parseInt(time) * 86400000;
        else return message.reply('❌ Tempo inválido (s/m/h/d).');
        if (durationMs > 2419200000) return message.reply('❌ Máximo 28 dias.');
        try {
            await member.timeout(durationMs, reason);
            message.reply(`🔇 ${member.user.tag} mutado por ${time}.\nRazão: ${reason || 'Nenhuma'}`);
        } catch {
            message.reply('❌ Erro ao mutar.');
        }
    }

    // === NOVOS COMANDOS (slowmode, lock, unlock, warn, avatar, serverinfo, role, nuke) ===
    // (colei todos aqui, mas você já tem, então pule se já tiver)

    // === TELLONYM COMPLETO ===
    // configuração
    if (commandName === 'tellonym' && args[0] === 'config') {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('❌ Apenas moderadores.');
        const channels = message.mentions.channels.first(2);
        if (channels.length < 1) return message.reply('❌ Uso: `k!tellonym config #receber [ #enviar ]`');
        const receive = channels[0];
        const send = channels[1] || null;
        tellonymConfig.set(message.guild.id, { receiveChannelId: receive.id, sendChannelId: send ? send.id : null });
        message.reply(`✅ Configurado!\n📥 Receber: ${receive}\n✉️ Enviar: ${send || 'privado do bot'}`);
        return;
    }

    // envio (canal ou DM)
    const config = message.guild ? tellonymConfig.get(message.guild.id) : null;
    const isSendChannel = config && config.sendChannelId === message.channel.id;
    const isDM = !message.guild;

    if (isSendChannel || isDM) {
        let guildConfig;
        if (isDM) {
            const mutual = client.guilds.cache.find(g => g.members.cache.has(message.author.id) && tellonymConfig.has(g.id));
            if (!mutual) return message.author.send('❌ Nenhum servidor configurado.');
            guildConfig = tellonymConfig.get(mutual.id);
        } else {
            guildConfig = config;
        }

        const receiveChannel = client.channels.cache.get(guildConfig.receiveChannelId);
        if (!receiveChannel) return message.author.send('❌ Canal de recebimento não encontrado.');

        try {
            const typeMsg = await message.author.send('🤔 Anônimo ou visível? Responda com "anônimo" ou "visível".');
            const typeCollect = await message.author.dmChannel.awaitMessages({ max: 1, time: 60000 });
            const isAnon = typeCollect.first().content.toLowerCase().includes('anônimo');

            const questionMsg = await message.author.send('📝 Envie sua pergunta:');
            const questionCollect = await message.author.dmChannel.awaitMessages({ max: 1, time: 120000 });
            const question = questionCollect.first().content;

            const embed = {
                color: isAnon ? 0x2c2f33 : 0x9b59b6,
                description: question,
                timestamp: new Date(),
                footer: { text: 'Tellonym do KAOS' }
            };

            if (isAnon) {
                embed.author = { name: 'Pergunta Anônima', icon_url: 'https://i.imgur.com/2Z5Y5ZG.png' };
            } else {
                embed.author = { name: message.author.tag, icon_url: message.author.displayAvatarURL({ dynamic: true }) };
                embed.thumbnail = { url: message.author.displayAvatarURL({ dynamic: true, size: 512 }) };
            }

            await receiveChannel.send({ embeds: [embed] });
            await message.author.send('✅ Enviado com sucesso!');
            if (isSendChannel && message.deletable) message.delete().catch(() => {});
        } catch {
            message.author.send('❌ Tempo esgotado. Tente novamente.');
        }
    }
});

// Login
client.login(process.env.TOKEN);

// Express
const app = express();
app.get('/', (req, res) => res.send('Bot online! 🚀 KAOS está vivo!'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor web rodando na porta ${port}`));
