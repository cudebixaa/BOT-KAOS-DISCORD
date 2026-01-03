const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');

// Configuração do cliente do bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // só se precisar ler mensagens normais
    ]
});

client.commands = new Collection();

// === Comandos Slash ===
const commands = [
    {
        name: 'ping',
        description: 'Verifica se o KAOS está online',
    },
    // Adicione mais comandos aqui depois
];

// Registro dos comandos
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
    console.log(`Online como ${client.user.tag}`); // "Online como KAOS#3399"

    await registerCommands();
});

// Resposta aos comandos
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        // Aqui está a resposta personalizada que você pediu
        await interaction.reply({
            content: `🔥 **KAOS online!**`,
            ephemeral: false // false = todo mundo no servidor vê; true = só quem usou vê
        });
    }
});

// Login seguro
client.login(process.env.TOKEN);

// === Servidor Express para Render ===
const app = express();

app.get('/', (req, res) => {
    res.send('Bot online! 🚀 KAOS está vivo!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor web rodando na porta ${port}`);
});
