const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
 
// ============================================================
//  ⚙️  CONFIGURATION — À MODIFIER
// ============================================================
 
const CONFIG = {
  // IDs Discord des utilisateurs autorisés à utiliser les commandes admin
  ADMIN_IDS: [
    '980099925071241227',
    '557275102358667277',
    '1475499606304358463',
    '1469795368580677717',
    '1465721989762256920',
    '535857300552810526',
  ],
 
  // Username TikTok à surveiller pour les lives (sans le @)
  TIKTOK_USERNAME: 'crousgainz',
 
  // Channel Discord où envoyer les alertes live (ID du channel)
  LIVE_CHANNEL_ID: '1473454771305185361',
 
  // Intervalle de vérification des lives TikTok (en ms) — défaut: 2 minutes
  LIVE_CHECK_INTERVAL: 2 * 60 * 1000,
 
  // Préfixe des commandes
  PREFIX: '!',
 
  // ROLE pour ticket: tout le monde du rôle peut voir, mais pas écrire (sauf staff + ouvreur).
  TICKET_VIEW_ROLE_ID: '1487674672865611806',
 
  // FIX ✅ : tableau d'IDs autorisés pour !mommy-asmr
  MOMMY_ASMR_USER_IDS: ['1469795368580677717', '535857300552810526'],
  MOMMY_ASMR_FILE_URL: 'https://cdn.discordapp.com/attachments/817794666778460160/1488669778313875606/ScreenRecording_03-20-2026_22-35-55_1.mp3?ex=69cd9f45&is=69cc4dc5&hm=23794ca2a2df4bb6ea4165d69675a442729720e01dd8abf70f1793270e97be2c&',
 
  // ============================================================
  //  🎭  REACTION ROLE — À MODIFIER
  // ============================================================
  REACTION_ROLE: {
    MESSAGE_ID: '1488586740162629823',
    CHANNEL_ID: '1488585932713103451',
    ROLE_ID:    '1488288795530100928',
    EMOJI:      '❤️',
  },
};
 
// ============================================================
//  📁  CHEMINS DES FICHIERS DE DONNÉES
// ============================================================
 
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  study:      path.join(DATA_DIR, 'study.json'),
  copes:      path.join(DATA_DIR, 'copes.json'),
  rules:      path.join(DATA_DIR, 'rules.json'),
  liveStatus: path.join(DATA_DIR, 'live_status.json'),
};
 
// Création du dossier data si inexistant
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
 
// ============================================================
//  💾  HELPERS JSON
// ============================================================
 
function loadJSON(file, defaultVal) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error(`Erreur lecture ${file}:`, e.message); }
  return defaultVal;
}
 
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error(`Erreur écriture ${file}:`, e.message); }
}
 
// ============================================================
//  📦  DONNÉES PAR DÉFAUT
// ============================================================
 
let studyData = loadJSON(FILES.study, {
  title: 'Aucune étude définie',
  url: '',
  description: 'Utilisez !def-etude pour définir une étude.',
  setBy: '',
  setAt: '',
});
 
let copesData = loadJSON(FILES.copes, {
  cope: ['Exemple Cope — Inutile'],
  interesting: ['Exemple Intéressant — Peut être utile'],
});
 
let rulesData = loadJSON(FILES.rules, {
  1: "Pas de demande de source : Il est interdit de demander, vendre ou partager des sources de stéroïdes, peptides ou autres substances dopantes. Les discussions éducatives générales peuvent être tolérées mais aucune source ou contact ne doit être partagé.",
  2: "Aucune discrimination : Les propos racistes, homophobes, sexistes ou discriminatoires sont strictement interdits sauf sur les iqlet. --> L'utilisation du N-word, P-word ou tout autre terme offensant est autorisé",
  3: "Respect obligatoire : Tout le monde doit être respecté. Les insultes, provocations, harcèlement ou comportements toxiques ne sont pas tolérés sauf si la personne est sous système fluide.",
  4: "Pas de spam : Le spam, flood, messages répétés, ou abus de majuscules sont interdits.",
  5: "Publicité interdite : Pas de promotion de chaînes, serveurs, produits ou services sans l'autorisation du staff.",
  6: "Contenu inapproprié : Les contenus NSFW, choquants ou illégaux sont interdits.",
  7: "Restez dans les bons salons : Merci d'utiliser les salons appropriés pour chaque sujet.",
  8: "Respect du staff : Les décisions du staff doivent être respectées. Si vous avez un problème on s'en fou on va pas lire.",
});
 
let liveStatus = loadJSON(FILES.liveStatus, { isLive: false, lastNotified: null });
 
// ============================================================
//  🤖  CLIENT DISCORD — FIX ✅ : Partials ajoutés
// ============================================================
 
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
 
// ============================================================
//  🔑  VÉRIFICATION ADMIN
// ============================================================
 
function isAdmin(userId) {
  return CONFIG.ADMIN_IDS.includes(userId);
}
 
// ============================================================
//  🎨  EMBEDS HELPER
// ============================================================
 
function embed(color = '#5865F2') {
  return new EmbedBuilder().setColor(color).setTimestamp();
}
 
// ============================================================
//  📚  COMMANDES
// ============================================================
 
const commands = {
 
  // --- AIDE ---
  '!aide': async (message) => {
    const e = embed('#5865F2')
      .setTitle('📖 Commandes disponibles')
      .addFields(
        { name: '📑 Études', value: '`!pubmed` — Affiche la dernière étude\n`!def-etude <titre> | <url> | <description>` *(admin)*', inline: false },
        { name: '💊 Compléments', value: '`!cope` — Liste des compléments\n`!add-cope <nom>` *(admin)*\n`!add-interesting <nom>` *(admin)*\n`!remove-cope <nom>` *(admin)*\n`!remove-interesting <nom>` *(admin)*', inline: false },
        { name: '📜 Règles', value: '`!regles` — Toutes les règles\n`!regle<N>` — Règle numéro N (ex: `!regle3`)\n`!set-regle <N> | <texte>` *(admin)*', inline: false },
        { name: '🔨 Modération', value: '`!ban <@user> [raison]` *(Permissions Ban)*\n`!source` — Mute auto 10min + CF règle 1\n`!mk677` — Mute auto 10min', inline: false },
        { name: '🎫 Tickets', value: '`!ticket <motif du role> | <motif de contestation>` — Ouvre un ticket privé visible par le rôle staff/config', inline: false },
        { name: '🎵 ASMR', value: '`!mommy-asmr` — Commande réservée aux IDs propriétaires (envoi MP3)', inline: false },
        { name: '🎭 Reaction Role', value: 'Réagis au message de bienvenue pour accéder au serveur', inline: false },
        { name: '🔴 Live', value: 'Détection auto des lives TikTok', inline: false },
      )
      .setFooter({ text: '*(admin) = Réservé aux utilisateurs autorisés' });
    await message.reply({ embeds: [e] });
  },
 
  // --- PUBMED ---
  '!pubmed': async (message) => {
    const fields = [
      { name: '📄 Titre', value: studyData.title || 'Non défini', inline: false },
    ];
    if (studyData.url) fields.push({ name: '🔗 Lien', value: studyData.url, inline: false });
    if (studyData.setBy) fields.push({ name: '👤 Définie par', value: `<@${studyData.setBy}>`, inline: true });
    if (studyData.setAt) fields.push({ name: '📅 Date', value: studyData.setAt, inline: true });
 
    const e = embed('#00B5D8')
      .setTitle('🔬 Dernière étude partagée')
      .setDescription(studyData.description || 'Aucune description.')
      .addFields(fields);
 
    await message.reply({ embeds: [e] });
  },
 
  '!def-etude': async (message, args) => {
    if (!isAdmin(message.author.id)) {
      return message.reply('❌ Tu n\'as pas la permission d\'utiliser cette commande.');
    }
    const fullText = args.join(' ');
    const parts = fullText.split('|').map(s => s.trim());
    if (parts.length < 2) {
      return message.reply('❌ Format : `!def-etude <titre> | <url> | <description>`\nL\'URL et la description sont optionnelles.');
    }
    studyData = {
      title: parts[0] || 'Sans titre',
      url: parts[1] || '',
      description: parts[2] || '',
      setBy: message.author.id,
      setAt: new Date().toLocaleDateString('fr-FR'),
    };
    saveJSON(FILES.study, studyData);
    await message.reply(`✅ Étude mise à jour : **${studyData.title}**`);
  },
 
  // --- COPE / INTÉRESSANT ---
  '!cope': async (message) => {
    const copeList = copesData.cope.length > 0
      ? copesData.cope.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : '*Aucun complément dans cette liste.*';
    const interestingList = copesData.interesting.length > 0
      ? copesData.interesting.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : '*Aucun complément dans cette liste.*';
 
    const e = embed('#FF6B6B')
      .setTitle('💊 Liste des compléments')
      .addFields(
        { name: '❌ COPE (Inutiles / À éviter)', value: copeList.slice(0, 1024), inline: false },
        { name: '✅ Intéressants / Utiles', value: interestingList.slice(0, 1024), inline: false },
      )
      .setFooter({ text: `${copesData.cope.length} cope(s) | ${copesData.interesting.length} intéressant(s)` });
    await message.reply({ embeds: [e] });
  },
 
  '!add-cope': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('❌ Format : `!add-cope <nom>`');
    if (copesData.cope.includes(name)) return message.reply('⚠️ Ce complément est déjà dans la liste Cope.');
    copesData.cope.push(name);
    saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** ajouté à la liste Cope.`);
  },
 
  '!add-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('❌ Format : `!add-interesting <nom>`');
    if (copesData.interesting.includes(name)) return message.reply('⚠️ Ce complément est déjà dans la liste Intéressants.');
    copesData.interesting.push(name);
    saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** ajouté à la liste Intéressants.`);
  },
 
  '!remove-cope': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    const idx = copesData.cope.indexOf(name);
    if (idx === -1) return message.reply(`❌ **${name}** introuvable dans la liste Cope.`);
    copesData.cope.splice(idx, 1);
    saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** retiré de la liste Cope.`);
  },
 
  '!remove-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    const idx = copesData.interesting.indexOf(name);
    if (idx === -1) return message.reply(`❌ **${name}** introuvable dans la liste Intéressants.`);
    copesData.interesting.splice(idx, 1);
    saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** retiré de la liste Intéressants.`);
  },
 
  // --- RÈGLES ---
  '!regles': async (message) => {
    const rulesList = Object.entries(rulesData)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([n, text]) => `**${n}.** ${text}`)
      .join('\n');
 
    const e = embed('#FAD961')
      .setTitle('📜 Règles du serveur')
      .setDescription(rulesList || '*Aucune règle définie.*');
    await message.reply({ embeds: [e] });
  },
 
  '!set-regle': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const fullText = args.join(' ');
    const parts = fullText.split('|').map(s => s.trim());
    if (parts.length < 2 || isNaN(Number(parts[0]))) {
      return message.reply('❌ Format : `!set-regle <numéro> | <texte>`');
    }
    const num = parts[0];
    rulesData[num] = parts[1];
    saveJSON(FILES.rules, rulesData);
    await message.reply(`✅ Règle **${num}** mise à jour.`);
  },
 
  // --- SOURCE (mute instantané sauf admins) ---
  '!source': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !source — CF : règle 1.');
      const e = embed('#FFA500')
        .setTitle('🔇 Mute automatique')
        .setDescription(`<@${message.author.id}> a été muté pendant 10 minutes.\n\n**CF : règle 1.**`);
      await message.reply({ embeds: [e] });
    } catch (err) {
      await message.reply(`❌ Impossible de muter : ${err.message}`);
    }
  },
 
  // --- MK677 (mute 10 min) ---
  '!mk677': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !mk677 — CF : règle 1.');
      const e = embed('#FF4444')
        .setTitle('🔇 Mute automatique (mk677)')
        .setDescription(`<@${message.author.id}> a été muté pendant 10 minutes pour avoir mentionné le MK-677.\n\n**CF : règle 1.**`);
      await message.reply({ embeds: [e] });
    } catch (err) {
      await message.reply(`❌ Impossible de muter : ${err.message}`);
    }
  },
 
  // --- BAN ---
  '!ban': async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ Tu n\'as pas la permission de bannir des membres.');
    }
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur à bannir : `!ban @user [raison]`');
    if (!target.bannable) return message.reply('❌ Je ne peux pas bannir cet utilisateur (rôle supérieur ou égal).');
 
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try {
      await target.ban({ reason: `${message.author.tag}: ${reason}`, deleteMessageSeconds: 604800 });
      const e = embed('#FF4444')
        .setTitle('🔨 Utilisateur banni')
        .addFields(
          { name: 'Utilisateur', value: target.user.tag, inline: true },
          { name: 'Par', value: message.author.tag, inline: true },
          { name: 'Raison', value: reason, inline: false },
        );
      await message.reply({ embeds: [e] });
    } catch (err) {
      await message.reply(`❌ Erreur lors du ban : ${err.message}`);
    }
  },
 
  // --- TICKET ---
  '!ticket': async (message, args) => {
    const fullText = args.join(' ');
    const parts = fullText.split('|').map(p => p.trim());
 
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return message.reply('❌ Format : `!ticket <motif du role> | <motif de contestation>`');
    }
 
    const motifRole = parts[0];
    const motifContest = parts[1];
    const ticketNumber = Math.floor(1000 + Math.random() * 9000);
    const ticketName = `ticket-${ticketNumber}`;
 
    const guild = message.guild;
    const viewRole = guild.roles.cache.get(CONFIG.TICKET_VIEW_ROLE_ID);
    if (!viewRole) {
      return message.reply('❌ Rôle de ticket introuvable. Vérifie la configuration.');
    }
 
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: viewRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages],
      },
      {
        id: message.author.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
      ...CONFIG.ADMIN_IDS.map((adminId) => ({
        id: adminId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      })),
    ];
 
    try {
      const channel = await guild.channels.create({
        name: ticketName,
        type: 0,
        permissionOverwrites: overwrites,
        reason: `Ouverture de ticket ${ticketNumber} par ${message.author.tag}`,
      });
 
      const ticketEmbed = embed('#00FF66')
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription('Ticket créé avec succès. Le staff vous répondra sous 24h. En cas de mauvaise défense, un warn peut être appliqué.')
        .addFields(
          { name: '🧾 Ouverture par', value: `<@${message.author.id}>`, inline: true },
          { name: '🧷 Rôle visualisation', value: `<@&${viewRole.id}>`, inline: true },
          { name: '📌 Motif du rôle', value: motifRole, inline: false },
          { name: '⚠️ Motif de contestation', value: motifContest, inline: false },
          { name: '⏳ Review staff', value: '24 heures', inline: true },
        )
        .setFooter({ text: `ID Ticket: ${ticketNumber}` });
 
      await channel.send({ content: `<@${message.author.id}>`, embeds: [ticketEmbed] });
      await message.reply(`✅ Ton ticket a été créé : ${channel}`);
    } catch (error) {
      console.error('Erreur création ticket:', error);
      message.reply(`❌ Impossible de créer le ticket : ${error.message}`);
    }
  },
 
  // --- MOMMY ASMR — FIX ✅ : tableau + catch propre ---
  '!mommy-asmr': async (message) => {
    if (!CONFIG.MOMMY_ASMR_USER_IDS.includes(message.author.id)) {
      return message.reply('❌ Tu n\'as pas la permission d\'utiliser cette commande.');
    }
    try {
      await message.channel.send({
        content: '🎧 Mommy ASMR en approche...',
        files: [CONFIG.MOMMY_ASMR_FILE_URL],
      });
    } catch (err) {
      await message.reply(`❌ Échec envoi ASMR : ${err.message}`);
    }
  },
};
 
// ============================================================
//  📩  HANDLER MESSAGES
// ============================================================
 
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;
 
  const [rawCmd, ...args] = message.content.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();
 
  if (commands[cmd]) {
    try { await commands[cmd](message, args); }
    catch (e) { console.error(`Erreur commande ${cmd}:`, e); message.reply('❌ Une erreur est survenue.'); }
    return;
  }
 
  // Règle dynamique : !regle1, !regle2, ...
  const ruleMatch = cmd.match(/^!regle(\d+)$/);
  if (ruleMatch) {
    const num = ruleMatch[1];
    if (rulesData[num]) {
      const e = embed('#FAD961')
        .setTitle(`📜 Règle ${num}`)
        .setDescription(rulesData[num]);
      await message.reply({ embeds: [e] });
    } else {
      await message.reply(`❌ La règle **${num}** n'existe pas. Utilisez \`!regles\` pour voir toutes les règles.`);
    }
    return;
  }
});
 
// ============================================================
//  🎭  REACTION ROLE
// ============================================================
 
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
 
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }
 
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;
 
  if (
    reaction.message.id !== MESSAGE_ID ||
    reaction.message.channel.id !== CHANNEL_ID ||
    reaction.emoji.name !== EMOJI
  ) return;
 
  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(ROLE_ID);
 
    if (!role) return console.error('[REACTION ROLE] Rôle introuvable :', ROLE_ID);
 
    await member.roles.add(role);
    console.log(`[REACTION ROLE] Rôle "${role.name}" donné à ${user.tag}`);
 
    try {
      await user.send('✅ Tu as bien reçu l\'accès au serveur ! Bienvenue 🎉');
    } catch {
      // DMs fermés, on ignore
    }
  } catch (err) {
    console.error('[REACTION ROLE] Erreur ajout rôle :', err.message);
  }
});
 
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
 
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }
 
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;
 
  if (
    reaction.message.id !== MESSAGE_ID ||
    reaction.message.channel.id !== CHANNEL_ID ||
    reaction.emoji.name !== EMOJI
  ) return;
 
  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(ROLE_ID);
 
    if (!role) return;
 
    await member.roles.remove(role);
    console.log(`[REACTION ROLE] Rôle "${role.name}" retiré à ${user.tag}`);
  } catch (err) {
    console.error('[REACTION ROLE] Erreur retrait rôle :', err.message);
  }
});
 
// ============================================================
//  📺  TIKTOK LIVE CHECKER
// ============================================================
 
async function checkTikTokLive() {
  try {
    const url = `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      timeout: 10000,
    });
 
    const html = response.data;
    const isCurrentlyLive = (
      html.includes('"statusStr":"LIVE_STATUS_STREAMING"') ||
      html.includes('"liveRoomInfo"') && html.includes('"status":2') ||
      html.includes('isLiveStreaming":true')
    );
 
    const channel = client.channels.cache.get(CONFIG.LIVE_CHANNEL_ID);
    if (!channel) return;
 
    if (isCurrentlyLive && !liveStatus.isLive) {
      liveStatus.isLive = true;
      liveStatus.lastNotified = new Date().toISOString();
      saveJSON(FILES.liveStatus, liveStatus);
 
      const e = embed('#FF0050')
        .setTitle('🔴 LIVE EN COURS !')
        .setDescription(`**@${CONFIG.TIKTOK_USERNAME}** est en live sur TikTok !`)
        .addFields({ name: '🔗 Rejoindre', value: `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, inline: false })
        .setFooter({ text: 'TikTok Live Detector' });
 
      await channel.send({ content: '@everyone 🔴 Un live vient de démarrer !', embeds: [e] });
      console.log(`[LIVE] @${CONFIG.TIKTOK_USERNAME} est en live.`);
 
    } else if (!isCurrentlyLive && liveStatus.isLive) {
      liveStatus.isLive = false;
      saveJSON(FILES.liveStatus, liveStatus);
      console.log(`[LIVE] @${CONFIG.TIKTOK_USERNAME} a terminé son live.`);
    }
 
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[LIVE] Rate limit TikTok, nouvelle tentative plus tard.');
    } else {
      console.error('[LIVE] Erreur vérification TikTok:', err.message);
    }
  }
}
 
// ============================================================
//  🚀  DÉMARRAGE
// ============================================================
 
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`👑 Admins: ${CONFIG.ADMIN_IDS.join(', ')}`);
  console.log(`📺 Surveillance TikTok: @${CONFIG.TIKTOK_USERNAME}`);
  console.log(`📢 Channel live: ${CONFIG.LIVE_CHANNEL_ID}`);
 
  checkTikTokLive();
  setInterval(checkTikTokLive, CONFIG.LIVE_CHECK_INTERVAL);
});
 
client.on('error', (err) => console.error('[Discord] Erreur client:', err));
 
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant ! Définissez la variable d\'environnement.');
  process.exit(1);
}
 
client.login(TOKEN);
