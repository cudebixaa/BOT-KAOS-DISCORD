const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');

// Configuração do cliente do bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// PREFIXO DO BOT
const PREFIX = 'k!';

// === SLASH COMMANDS ===
const commands = [
    {
        name: 'ping',
        description: 'Verifica se o KAOS está online'
    }
];

// Registro dos slash commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Registrando slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user?.id || 'SEU_BOT_ID'),
            { body: commands }
        );
        console.log('Slash commands registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
}

// Quando o bot ficar online
client.once('ready', async () => {
    console.log(`Online como ${client.user.tag}`);
    await registerCommands();
});

// Resposta ao slash /ping
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply('🔥 **KAOS online!**');
    }
});

// === SISTEMA TELLONYM ===
const tellonymConfig = new Map(); // guildId -> { receiveChannelId, sendChannelId }

// === COMANDOS COM PREFIXO k! ===
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
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('❌ Você não tem permissão para apagar mensagens.');
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 99) {
            return message.reply('❌ Use: `k!clear <1 a 99>`');
        }

        try {
            await message.channel.bulkDelete(amount + 1, true);
            const msg = await message.channel.send(`🧹 Apaguei ${amount} mensagens.`);
            setTimeout(() => msg.delete(), 3000);
        } catch (error) {
            message.reply('❌ Erro ao apagar (mensagens antigas demais?).');
        }
    }

    // EMBED PADRÃO PARA PUNIÇÕES
    const punishmentEmbed = (member, reason, type, color, duration = null) => {
        const fields = [
            { name: 'Usuário', value: `${member}`, inline: true },
            { name: 'Moderador', value: `${message.author}`, inline: true },
            { name: 'Razão', value: reason || 'Sem razão informada', inline: false }
        ];

        if (duration) fields.splice(2, 0, { name: 'Duração', value: duration, inline: true });

        return {
            color: color,
            author: {
                name: member.user.tag,
                icon_url: member.user.displayAvatarURL({ size: 256, dynamic: true })
            },
            thumbnail: {
                url: member.user.displayAvatarURL({ size: 512, dynamic: true })
            },
            fields: fields,
            title: type,
            timestamp: new Date(),
            footer: { text: 'KAOS Moderation' }
        };
    };

    // k!ban @user [razão]
    if (commandName === 'ban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Você não tem permissão para banir.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione um usuário válido.');

        if (!member.bannable) return message.reply('❌ Não consigo banir esse usuário (cargo maior?).');

        const reason = args.slice(1).join(' ');

        try {
            await member.ban({ reason });
            const embed = punishmentEmbed(member, reason, 'Usuário Banido Permanentemente 🔨', 0xFF0000);
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            message.reply('❌ Erro ao banir.');
        }
    }

    // k!kick @user [razão]
    if (commandName === 'kick') {
        if (!message.member.permissions.has('KickMembers')) {
            return message.reply('❌ Você não tem permissão para expulsar.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione um usuário válido.');

        if (!member.kickable) return message.reply('❌ Não consigo expulsar esse usuário (cargo maior?).');

        const reason = args.slice(1).join(' ');

        try {
            await member.kick(reason);
            const embed = punishmentEmbed(member, reason, 'Usuário Expulso do Servidor 👢', 0xFFA500);
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            message.reply('❌ Erro ao expulsar.');
        }
    }

    // k!mute @user <tempo> [razão]
    if (commandName === 'mute' || commandName === 'timeout') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('❌ Você não tem permissão para mutar.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione um usuário válido.');

        if (!member.moderatable) return message.reply('❌ Não consigo mutar esse usuário (cargo maior?).');

        const time = args[1];
        if (!time) return message.reply('❌ Informe o tempo: `k!mute @user 10m razão` (s/m/h/d)');

        const reason = args.slice(2).join(' ');

        let durationMs;
        if (time.endsWith('s')) durationMs = parseInt(time) * 1000;
        else if (time.endsWith('m')) durationMs = parseInt(time) * 60000;
        else if (time.endsWith('h')) durationMs = parseInt(time) * 3600000;
        else if (time.endsWith('d')) durationMs = parseInt(time) * 86400000;
        else return message.reply('❌ Tempo inválido. Use s, m, h ou d (ex: 5m, 1h, 7d).');

        if (durationMs > 2419200000) return message.reply('❌ Tempo máximo: 28 dias.');

        try {
            await member.timeout(durationMs, reason);
            const embed = punishmentEmbed(member, reason, 'Usuário Mutado 🔇', 0x3498DB, time);
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            message.reply('❌ Erro ao mutar.');
        }
    }

    // k!slowmode <segundos ou off>
    if (commandName === 'slowmode') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Você não tem permissão para gerenciar canais.');
        }

        if (!args[0]) return message.reply('❌ Uso: `k!slowmode <segundos>` ou `k!slowmode off`');

        if (args[0].toLowerCase() === 'off') {
            await message.channel.setRateLimitPerUser(0);
            return message.reply('⏩ Slowmode desativado neste canal.');
        }

        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
            return message.reply('❌ Tempo inválido. Use de 0 a 21600 segundos (6 horas).');
        }

        await message.channel.setRateLimitPerUser(seconds);
        message.reply(`⏱ Slowmode ativado: 1 mensagem a cada **${seconds} segundos**.`);
    }

    // k!lock
    if (commandName === 'lock') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Você não tem permissão para gerenciar canais.');
        }

        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply('🔒 Canal travado. Apenas cargos com permissão podem falar.');
    }

    // k!unlock
    if (commandName === 'unlock') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Você não tem permissão para gerenciar canais.');
        }

        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        message.reply('🔓 Canal destravado. Todos podem falar novamente.');
    }

    // k!warn @user [razão]
    if (commandName === 'warn') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('❌ Você não tem permissão para avisar membros.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione um usuário válido.');

        const reason = args.slice(1).join(' ') || 'Sem razão informada';

        const warnEmbed = {
            color: 0xFFAA00,
            title: '⚠️ Você recebeu um aviso',
            description: `**Servidor:** ${message.guild.name}\n**Razão:** ${reason}\n**Moderador:** ${message.author.tag}`,
            timestamp: new Date(),
            footer: { text: 'KAOS Moderation' }
        };

        try {
            await member.send({ embeds: [warnEmbed] });
            message.reply(`⚠️ ${member.user.tag} foi avisado no privado.\nRazão: ${reason}`);
        } catch {
            message.reply(`⚠️ ${member.user.tag} foi avisado (não consegui mandar no privado).\nRazão: ${reason}`);
        }
    }

    // k!avatar [@user]
    if (commandName === 'avatar') {
        const member = message.mentions.members.first() || message.member;
        const avatarURL = member.user.displayAvatarURL({ size: 1024, dynamic: true });

        const embed = {
            color: 0x9b59b6,
            title: `🖼 Avatar de ${member.user.tag}`,
            image: { url: avatarURL },
            footer: { text: 'Clique para ampliar' }
        };

        message.reply({ embeds: [embed] });
    }

    // k!serverinfo ou k!info
    if (commandName === 'serverinfo' || commandName === 'info') {
        const guild = message.guild;

        const embed = {
            color: 0x3498DB,
            title: `ℹ️ Informações do Servidor: ${guild.name}`,
            thumbnail: { url: guild.iconURL({ dynamic: true }) },
            fields: [
                { name: '👑 Dono', value: `<@${guild.ownerId}>`, inline: true },
                { name: '📅 Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '👥 Membros', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Canais', value: `${guild.channels.cache.size}`, inline: true },
                { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0} (Nível ${guild.premiumTier})`, inline: true },
                { name: '🆔 ID', value: `${guild.id}`, inline: false }
            ],
            timestamp: new Date()
        };

        message.reply({ embeds: [embed] });
    }

    // k!role @cargo @user
    if (commandName === 'role') {
        if (!message.member.permissions.has('ManageRoles')) {
            return message.reply('❌ Você não tem permissão para gerenciar cargos.');
        }

        const role = message.mentions.roles.first();
        const member = message.mentions.members.first();

        if (!role || !member) return message.reply('❌ Uso: `k!role @cargo @user`');

        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply('❌ Não consigo gerenciar esse cargo (maior que o meu).');
        }

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            message.reply(`❌ Cargo ${role} removido de ${member.user.tag}.`);
        } else {
            await member.roles.add(role);
            message.reply(`✅ Cargo ${role} adicionado a ${member.user.tag}.`);
        }
    }

    // k!nuke
    if (commandName === 'nuke') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Você não tem permissão para gerenciar canais.');
        }

        const channel = message.channel;
        const position = channel.position;
        const parent = channel.parent;

        try {
            const newChannel = await channel.clone();
            await channel.delete();
            await newChannel.setPosition(position);
            if (parent) await newChannel.setParent(parent);
            newChannel.send('💥 **Canal nukado e recriado! Tudo limpo agora.**');
        } catch (error) {
            message.reply('❌ Erro ao nukar. Verifique minhas permissões.');
        }
    }

    // === TELLONYM ===
    if (commandName === 'tellonym' && args[0] === 'config') {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('❌ Apenas moderadores.');
        const channels = message.mentions.channels.first(2);
        if (channels.length < 1) return message.reply('❌ Uso: `k!tellonym config #receber [ #enviar ]`');
        const receive = channels[0];
        const send = channels[1] || null;
        tellonymConfig.set(message.guild.id, { receiveChannelId: receive.id, sendChannelId: send ? send.id : null });
        message.reply(`✅ Configurado! Receber: ${receive} Enviar: ${send || 'privado'}`);
        return;
    }

    // Envio Tellonym
    const config = message.guild ? tellonymConfig.get(message.guild.id) : null;
    const isSendChannel = config && config.sendChannelId === message.channel.id;
    const isDM = !message.guild;

    if (isSendChannel || isDM) {
        let guildConfig = config;
        if (isDM) {
            const mutual = client.guilds.cache.find(g => g.members.cache.has(message.author.id) && tellonymConfig.has(g.id));
            if (!mutual) return message.author.send('❌ Nenhum servidor configurado.');
            guildConfig = tellonymConfig.get(mutual.id);
        }

        const receiveChannel = client.channels.cache.get(guildConfig.receiveChannelId);
        if (!receiveChannel) return message.author.send('❌ Canal de recebimento não encontrado.');

        try {
            await message.author.send('🤔 Anônimo ou visível? Responda com "anônimo" ou "visível".');
            const typeCollect = await message.author.dmChannel.awaitMessages({ max: 1, time: 60000 });
            const isAnon = typeCollect.first().content.toLowerCase().includes('anônimo');

            await message.author.send('📝 Envie sua pergunta:');
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
            await message.author.send('✅ Enviado!');
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
app.listen(process.env.PORT || 3000, () => console.log(`Servidor web rodando na porta ${process.env.PORT || 3000}`));
