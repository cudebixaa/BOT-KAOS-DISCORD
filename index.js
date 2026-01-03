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
        await interaction.reply('KAOS online!');
    }
});

// === EMBED PADRÃO PARA PUNIÇÕES ===
const punishmentEmbed = (userTag, avatarURL, reason, type, color, duration = null, moderator = null) => {
    const fields = [
        { name: 'Razão', value: reason || 'Sem razão informada', inline: false }
    ];
    if (duration) fields.unshift({ name: 'Duração', value: duration, inline: true });
    if (moderator) fields.unshift({ name: 'Moderador', value: moderator, inline: true });

    return {
        color: color,
        author: {
            name: userTag,
            icon_url: avatarURL
        },
        thumbnail: { url: avatarURL },
        fields: fields,
        title: type,
        timestamp: new Date(),
        footer: { text: 'Moderação da KAOS' }
    };
};

// === TODOS OS COMANDOS COM PREFIXO k! ===
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // k!ping
    if (commandName === 'ping') {
        await message.reply('KAOS online!');
    }

    // k!clear ou k!cl ou k!limpar — silencioso
    if (commandName === 'clear' || commandName === 'cl' || commandName === 'limpar') {
        if (!message.member.permissions.has('ManageMessages')) return message.reply('Você não tem permissão para apagar mensagens.');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 99) return message.reply('Use: `k!clear <1 a 99>`');
        try {
            await message.channel.bulkDelete(amount + 1, true);
        } catch {
            message.reply('Erro ao apagar mensagens (antigas demais?).');
        }
    }

    // k!ban @user [razão]
    if (commandName === 'ban') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('Você não tem permissão para banir.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.bannable) return message.reply('Não consigo banir esse usuário (cargo maior?).');
        const reason = args.slice(1).join(' ') || 'Sem razão informada';

        try {
            const fetched = await message.channel.messages.fetch({ limit: 100 });
            const userMsgs = fetched.filter(m => m.author.id === member.id).first(4);
            if (userMsgs.length > 0) await message.channel.bulkDelete(userMsgs, true);

            await member.ban({ reason });
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), reason, 'Usuário Banido Permanentemente', 0xFF0000, null, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao banir.');
        }
    }

    // k!kick @user [razão]
    if (commandName === 'kick') {
        if (!message.member.permissions.has('KickMembers')) return message.reply('Você não tem permissão para expulsar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.kickable) return message.reply('Não consigo expulsar esse usuário.');
        const reason = args.slice(1).join(' ') || 'Sem razão informada';

        try {
            await member.kick(reason);
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), reason, 'Usuário Expulso do Servidor', 0xFFA500, null, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao expulsar.');
        }
    }

    // k!mute @user <tempo> [razão]
    if (commandName === 'mute' || commandName === 'timeout') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('Você não tem permissão para mutar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.moderatable) return message.reply('Não consigo mutar esse usuário.');
        const time = args[1];
        if (!time) return message.reply('Informe o tempo (ex: 10m).');
        const reason = args.slice(2).join(' ') || 'Sem razão informada';

        let durationMs;
        if (time.endsWith('s')) durationMs = parseInt(time) * 1000;
        else if (time.endsWith('m')) durationMs = parseInt(time) * 60000;
        else if (time.endsWith('h')) durationMs = parseInt(time) * 3600000;
        else if (time.endsWith('d')) durationMs = parseInt(time) * 86400000;
        else return message.reply('Tempo inválido (s/m/h/d).');

        if (durationMs > 2419200000) return message.reply('Máximo 28 dias.');

        try {
            const fetched = await message.channel.messages.fetch({ limit: 100 });
            const userMsgs = fetched.filter(m => m.author.id === member.id).first(4);
            if (userMsgs.length > 0) await message.channel.bulkDelete(userMsgs, true);

            await member.timeout(durationMs, reason);
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), reason, 'Usuário Mutado', 0x3498DB, time, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao mutar.');
        }
    }

    // k!unmute @user
    if (commandName === 'unmute' || commandName === 'desmutar') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('Você não tem permissão para desmutar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.communicationDisabledUntil) return message.reply('Usuário não está mutado.');

        try {
            await member.timeout(null);
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), 'Desmutado', 'Usuário Desmutado', 0x00FF00, null, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao desmutar.');
        }
    }

    // k!unban <ID> [razão]
    if (commandName === 'unban' || commandName === 'desbanir') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('Você não tem permissão para desbanir.');
        const userId = args[0];
        if (!userId) return message.reply('Uso: `k!unban <ID>`');

        try {
            const ban = await message.guild.bans.fetch(userId);
            const reason = args.slice(1).join(' ') || 'Sem razão informada';
            await message.guild.bans.remove(userId, reason);

            const embed = {
                color: 0x00FF00,
                title: 'Usuário Desbanido',
                fields: [
                    { name: 'Usuário', value: `\( {ban.user.tag} ( \){userId})`, inline: true },
                    { name: 'Moderador', value: `${message.author.tag}`, inline: true },
                    { name: 'Razão do desban', value: reason, inline: false }
                ],
                timestamp: new Date(),
                footer: { text: 'Moderação da KAOS' }
            };
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Usuário não banido ou erro ao desbanir.');
        }
    }

    // k!slowmode
    if (commandName === 'slowmode') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        if (!args[0]) return message.reply('Uso: `k!slowmode <segundos>` ou `k!slowmode off`');
        if (args[0].toLowerCase() === 'off') {
            await message.channel.setRateLimitPerUser(0);
            return message.reply('Slowmode desativado neste canal.');
        }
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply('Tempo inválido (0 a 21600 segundos).');
        await message.channel.setRateLimitPerUser(seconds);
        message.reply(`Slowmode ativado: 1 mensagem a cada ${seconds} segundos.`);
    }

    // k!lock
    if (commandName === 'lock') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply('Canal travado.');
    }

    // k!unlock
    if (commandName === 'unlock') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        message.reply('Canal destravado.');
    }

    // k!warn @user [razão]
    if (commandName === 'warn') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('Você não tem permissão para avisar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        const reason = args.slice(1).join(' ') || 'Sem razão informada';
        const warnEmbed = {
            color: 0xFFAA00,
            title: 'Aviso Recebido',
            description: `**Servidor:** ${message.guild.name}\n**Razão:** ${reason}\n**Moderador:** ${message.author.tag}`,
            timestamp: new Date(),
            footer: { text: 'Moderação da KAOS' }
        };
        try {
            await member.send({ embeds: [warnEmbed] });
            message.reply(`${member.user.tag} foi avisado no privado.`);
        } catch {
            message.reply(`${member.user.tag} foi avisado (privado fechado).`);
        }
    }

    // k!avatar [@user]
    if (commandName === 'avatar') {
        const member = message.mentions.members.first() || message.member;
        const avatarURL = member.user.displayAvatarURL({ size: 1024, dynamic: true });
        const embed = {
            color: 0x9b59b6,
            title: `Avatar de ${member.user.tag}`,
            image: { url: avatarURL },
            footer: { text: 'Clique para ampliar' }
        };
        message.channel.send({ embeds: [embed] });
    }

    // k!serverinfo ou k!info
    if (commandName === 'serverinfo' || commandName === 'info') {
        const guild = message.guild;
        const embed = {
            color: 0x3498DB,
            title: `Informações do Servidor: ${guild.name}`,
            thumbnail: { url: guild.iconURL({ dynamic: true }) || null },
            fields: [
                { name: 'Dono', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: 'Membros', value: `${guild.memberCount}`, inline: true },
                { name: 'Canais', value: `${guild.channels.cache.size}`, inline: true },
                { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0} (Nível ${guild.premiumTier})`, inline: true },
                { name: 'ID', value: `${guild.id}`, inline: false }
            ],
            timestamp: new Date(),
            footer: { text: 'Moderação da KAOS' }
        };
        message.channel.send({ embeds: [embed] });
    }

    // k!role @cargo @user
    if (commandName === 'role') {
        if (!message.member.permissions.has('ManageRoles')) return message.reply('Você não tem permissão para gerenciar cargos.');
        const role = message.mentions.roles.first();
        const member = message.mentions.members.first();
        if (!role || !member) return message.reply('Uso: `k!role @cargo @user`');
        if (role.position >= message.guild.members.me.roles.highest.position) return message.reply('Cargo maior que o meu.');
        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            message.reply(`Cargo ${role} removido de ${member.user.tag}.`);
        } else {
            await member.roles.add(role);
            message.reply(`Cargo ${role} adicionado a ${member.user.tag}.`);
        }
    }

    // k!nuke
    if (commandName === 'nuke') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão.');
        const channel = message.channel;
        const position = channel.position;
        const parent = channel.parent;
        try {
            const newChannel = await channel.clone();
            await channel.delete();
            await newChannel.setPosition(position);
            if (parent) await newChannel.setParent(parent);
            newChannel.send('Canal nukado e recriado! Tudo limpo.');
        } catch {
            message.reply('Erro ao nukar.');
        }
    }

    // === TELLONYM ===
    if (commandName === 'tellonym' && args[0] === 'config') {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('Apenas moderadores.');
        const channels = message.mentions.channels.first(2);
        if (channels.length < 1) return message.reply('Uso: `k!tellonym config #receber [ #enviar ]`');
        const receive = channels[0];
        const send = channels[1] || null;
        tellonymConfig.set(message.guild.id, { receiveChannelId: receive.id, sendChannelId: send ? send.id : null });
        message.reply(`Configurado!\nReceber: ${receive}\nEnviar: ${send || 'privado do bot'}`);
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
            if (!mutual) return message.author.send('Nenhum servidor configurado.');
            guildConfig = tellonymConfig.get(mutual.id);
        }

        const receiveChannel = client.channels.cache.get(guildConfig.receiveChannelId);
        if (!receiveChannel) return message.author.send('Canal de recebimento não encontrado.');

        try {
            await message.author.send('Anônimo ou visível? Responda com "anônimo" ou "visível".');
            const typeCollect = await message.author.dmChannel.awaitMessages({ max: 1, time: 60000 });
            const isAnon = typeCollect.first().content.toLowerCase().includes('anônimo');

            await message.author.send('Envie sua pergunta:');
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
            await message.author.send('Enviado com sucesso!');
            if (isSendChannel && message.deletable) message.delete().catch(() => {});
        } catch {
            message.author.send('Tempo esgotado. Tente novamente.');
        }
    }
});


// === RESPOSTAS AUTOMÁTICAS A PALAVRAS ESPECÍFICAS ===
    const respostasAutomaticas = {
        'dafuria': 'cafajeste',
        'levi': 'gostoso'
    };

    // Verifica se a mensagem contém alguma palavra-chave (ignorando maiúscula/minúscula)
    const mensagemLower = message.content.toLowerCase();
    for (const [palavra, resposta] of Object.entries(respostasAutomaticas)) {
        if (mensagemLower.includes(palavra)) {
            await message.reply(resposta);
            break; // responde só a primeira palavra encontrada na mensagem
        }
    } 

// Login
client.login(process.env.TOKEN);

// Express
const app = express();
app.get('/', (req, res) => res.send('Bot online! KAOS está vivo!'));
app.listen(process.env.PORT || 3000, () => console.log(`Servidor web rodando na porta ${process.env.PORT || 3000}`));
