const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');

// Configuração do bot com intents necessárias
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Obrigatório para comandos com prefixo
    ]
});

// Coleções (não precisa mexer)
client.commands = new Collection();

// PREFIXO DO BOT
const PREFIX = 'k!';

// === SLASH COMMANDS (globais) ===
const commands = [
    {
        name: 'ping',
        description: 'Verifica se o KAOS está online'
    }
];

// Registro automático dos slash commands
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

// Evento: Bot online
client.once('ready', async () => {
    console.log(`Online como ${client.user.tag}`);
    await registerCommands();
});

// Resposta ao /ping (slash command)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply('🔥 **KAOS online!**');
    }
});

// === COMANDOS COM PREFIXO k! ===
client.on('messageCreate', async (message) => {
console.log(`Mensagem recebida: ${message.content} de ${message.author.tag}`);


    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return; // Só funciona em servidores

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // k!ping
    if (commandName === 'ping') {
        await message.reply('🔥 **KAOS online!**');
    }

    // k!clear ou k!limpar
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

    // k!ban @user [razão]
    if (commandName === 'ban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Você não tem permissão para banir.');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ Mencione um usuário válido.');

        if (!member.bannable) return message.reply('❌ Não consigo banir esse usuário (cargo maior?).');

        const reason = args.slice(1).join(' ') || 'Sem razão informada';

        try {
            await member.ban({ reason });
            message.reply(`🔨 ${member.user.tag} foi banido.\nRazão: ${reason}`);
        } catch (error) {
            message.reply('❌ Erro ao banir.');
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
        if (!time) return message.reply('❌ Informe o tempo: `k!mute @user 10m` (s/m/h/d)');

        const reason = args.slice(2).join(' ') || 'Sem razão informada';

        let durationMs;
        if (time.endsWith('s')) durationMs = parseInt(time) * 1000;
        else if (time.endsWith('m')) durationMs = parseInt(time) * 60000;
        else if (time.endsWith('h')) durationMs = parseInt(time) * 3600000;
        else if (time.endsWith('d')) durationMs = parseInt(time) * 86400000;
        else return message.reply('❌ Tempo inválido. Use s, m, h ou d.');

        if (durationMs > 2419200000) return message.reply('❌ Máximo: 28 dias.');

        try {
            await member.timeout(durationMs, reason);
            message.reply(`🔇 ${member.user.tag} mutado por ${time}.\nRazão: ${reason}`);
        } catch (error) {
            message.reply('❌ Erro ao mutar.');
        }
    }
});

// Login seguro
client.login(process.env.TOKEN);

// === SERVIDOR EXPRESS (pra Render não dormir) ===
const app = express();

app.get('/', (req, res) => {
    res.send('Bot online! 🚀 KAOS está vivo!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor web rodando na porta ${port}`);
});
