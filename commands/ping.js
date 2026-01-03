module.exports = {
  data: {
    name: 'ping',
    description: 'Testa se o bot está vivo'
  },

  async execute(interaction) {
    await interaction.reply('🏓 Pong! KAOS online.');
  }
};
