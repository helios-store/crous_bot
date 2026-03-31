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
    '980099925071241227',  // ← Remplace par ton ID Discord
    '557275102358667277', // ← Ajoute d'autres IDs si besoin
    '1475499606304358463', // ← Ajoute d'autres IDs si besoin
    '1469795368580677717', // ← Ajoute d'autres IDs si besoin
    '1465721989762256920', // ← Ajoute d'autres IDs si besoin
    '535857300552810526', // ← Ajoute d'autres IDs si besoin
  ],
 
  // Username TikTok à surveiller pour les lives (sans le @)
  TIKTOK_USERNAME: 'crousgainz',
 
  // Channel Discord où envoyer les alertes live (ID du channel)
  LIVE_CHANNEL_ID: '1181558040131010593',  // ← Remplace par l'ID du channel
 
  // Intervalle de vérification des lives TikTok (en ms) — défaut: 2 minutes
  LIVE_CHECK_INTERVAL: 2 * 60 * 1000,
 
  // Préfixe des commandes
  PREFIX: '!',
 
  // ============================================================
  //  🎭  REACTION ROLE — À MODIFIER
  // ============================================================
  REACTION_ROLE: {
    MESSAGE_ID: '1488586740162629823',  // ← ID du message sur lequel réagir
    CHANNEL_ID: '1488585932713103451',  // ← ID du channel où se trouve le message
    ROLE_ID:    '1488288795530100928',  // ← ID du rôle à donner
    EMOJI:      '✅',                  // ← Emoji de la réaction (ex: ✅ ou un emoji custom)
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
  cope: [
    'Exemple Cope — Inutile',
  ],
  interesting: [
    'Exemple Intéressant — Peut être utile',
  ],
});
 
let rulesData = loadJSON(FILES.rules, {
  1: "Respectez tous les membres du serveur.",
  2: "Pas de spam ni de flood.",
  3: "Pas de contenu NSFW hors channels dédiés.",
  4: "Pas de publicité non autorisée.",
  5: "Respectez les décisions des modérateurs.",
  6: "Pas de partage d'informations personnelles d'autrui.",
  7: "Restez dans les sujets des channels.",
  8: "Toute infraction grave entraîne un ban direct.",
});
 
let liveStatus = loadJSON(FILES.liveStatus, { isLive: false, lastNotified: null });
 
// ============================================================
//  🤖  CLIENT DISCORD
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
        { name: '🔨 Modération', value: '`!ban <@user> [raison]` *(Permissions Ban)*\n`!source` — Mute auto 10min + CF règle 1\n`!mk677` — Kick auto', inline: false },
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
 
  // --- MK677 (kick instantané sauf admins) ---
  '!mk677': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      const e = embed('#FF4444')
        .setTitle('👢 Kick automatique')
        .setDescription(`<@${message.author.id}> a été kické pour avoir mentionné le MK-677.`);
      await message.reply({ embeds: [e] });
      await message.member.kick('Utilisation de !mk677');
    } catch (err) {
      await message.reply(`❌ Impossible de kicker : ${err.message}`);
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
};
 
// ============================================================
//  📩  HANDLER MESSAGES
// ============================================================
 
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;
 
  const [rawCmd, ...args] = message.content.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();
 
  // Commande directe
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
 
// Quand quelqu'un ajoute une réaction
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
 
  // Récupère le message complet si partiel
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }
 
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;
 
  // Vérifie que c'est le bon message, le bon channel et le bon emoji
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
 
    // Message privé de confirmation
    try {
      await user.send(`✅ Tu as bien reçu l'accès au serveur ! Bienvenue 🎉`);
    } catch {
      // DMs fermés, on ignore
    }
  } catch (err) {
    console.error('[REACTION ROLE] Erreur ajout rôle :', err.message);
  }
});
 
// Quand quelqu'un retire sa réaction
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
 
async function checkTikTokLive() {
  try {
    // On scrape la page TikTok pour détecter un live actif
    const url = `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      timeout: 10000,
    });
 
    // Indicateurs de live actif dans le HTML TikTok
    const html = response.data;
    const isCurrentlyLive = (
      html.includes('"statusStr":"LIVE_STATUS_STREAMING"') ||
      html.includes('"liveRoomInfo"') && html.includes('"status":2') ||
      html.includes('isLiveStreaming":true')
    );
 
    const channel = client.channels.cache.get(CONFIG.LIVE_CHANNEL_ID);
    if (!channel) return;
 
    if (isCurrentlyLive && !liveStatus.isLive) {
      // Live vient de démarrer
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
      // Live terminé
      liveStatus.isLive = false;
      saveJSON(FILES.liveStatus, liveStatus);
      console.log(`[LIVE] @${CONFIG.TIKTOK_USERNAME} a terminé son live.`);
    }
 
  } catch (err) {
    // Erreur silencieuse (rate limit, réseau, etc.)
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
 
  // Lancement de la vérification live
  checkTikTokLive();
  setInterval(checkTikTokLive, CONFIG.LIVE_CHECK_INTERVAL);
});
 
client.on('error', (err) => console.error('[Discord] Erreur client:', err));
 
// Token depuis variable d'environnement (Railway)
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant ! Définissez la variable d\'environnement.');
  process.exit(1);
}
 
client.login(TOKEN);
