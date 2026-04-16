const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ============================================================
//  CONFIGURATION
// ============================================================

const CONFIG = {
  ADMIN_IDS: [
    '980099925071241227',
    '557275102358667277',
    '1475499606304358463',
    '1469795368580677717',
    '1465721989762256920',
    '535857300552810526',
  ],

  TIKTOK_USERNAME: 'crousgainz',
  LIVE_CHANNEL_ID: '1473454771305185361',
  LIVE_CHECK_INTERVAL: 2 * 60 * 1000,
  PREFIX: '!',

  MOMMY_ASMR_USER_IDS: ['1469795368580677717', '535857300552810526', '1475499606304358463'],
  MOMMY_ASMR_FILE_URL: 'https://image2url.com/r2/default/audio/1775167126789-12d55369-adb5-4c88-8e88-58eb4a3d6d07.mp3',

  REACTION_ROLE: {
    MESSAGE_ID: '1488290011425149022',
    CHANNEL_ID: '1488289976540991770',
    ROLE_ID:    '1487674672865611806',  // ancien rôle (sera remplacé par VERIF_PENDING si vérif activée)
    EMOJI:      '\u2705',
  },

  JAIL_ACCESS_ROLE_ID:    '1487674672865611806',
  JAIL_PRISON_CHANNEL_ID: '1489385660979872005',
  JAIL_DURATION_MS:       5 * 60 * 1000,
  JAIL_PROTECTED_ROLE_IDS: [],

  // ── RATING SYSTÈME ──────────────────────────────────────────
  RATING_ROLE_ID: '1490645216192102421',

  // ── JSONBIN CONFIG ───────────────────────────────────────────
  JSONBIN_MASTER_KEY: process.env.JSONBIN_MASTER_KEY || '$2a$10$AwINYOxVh1uCEQVco3Da1uJf/hMkwcibwHt7r5CVoUsEbC36wGr8u',
  JSONBIN_BIN_ID:     process.env.JSONBIN_BIN_ID     || '',

  // ── VÉRIFICATION MANUELLE ────────────────────────────────────
  // Configure via !verif-setup ou directement ici :
  // VERIF_PENDING_ROLE_ID : rôle donné après réaction (accès channel vérif uniquement)
  // VERIF_APPROVED_ROLE_ID : rôle final après approbation admin (accès complet serveur)
  // VERIF_CHANNEL_ID : channel où le membre attend sa vérification
  // VERIF_LOG_CHANNEL_ID : channel privé admin où arrivent les demandes de vérif
  VERIF_PENDING_ROLE_ID:  process.env.VERIF_PENDING_ROLE_ID  || '',
  VERIF_APPROVED_ROLE_ID: process.env.VERIF_APPROVED_ROLE_ID || '',
  VERIF_CHANNEL_ID:       process.env.VERIF_CHANNEL_ID       || '',
  VERIF_LOG_CHANNEL_ID:   process.env.VERIF_LOG_CHANNEL_ID   || '',
};

// ============================================================
//  CHEMINS DES FICHIERS DE DONNÉES LOCAUX
// ============================================================

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  study:         path.join(DATA_DIR, 'study.json'),
  copes:         path.join(DATA_DIR, 'copes.json'),
  rules:         path.join(DATA_DIR, 'rules.json'),
  liveStatus:    path.join(DATA_DIR, 'live_status.json'),
  reactionRoles: path.join(DATA_DIR, 'reaction_roles.json'),
  ticketConfig:  path.join(DATA_DIR, 'ticket_config.json'),
  tickets:       path.join(DATA_DIR, 'tickets.json'),
  warns:         path.join(DATA_DIR, 'warns.json'),
  jails:         path.join(DATA_DIR, 'jails.json'),
  sanctionLog:   path.join(DATA_DIR, 'sanction_log.json'),
  npcList:       path.join(DATA_DIR, 'npc_list.json'),
  tfList:        path.join(DATA_DIR, 'tf_list.json'),
  tournaments:   path.join(DATA_DIR, 'tournaments.json'),
  jsonbinId:     path.join(DATA_DIR, 'jsonbin_id.json'),
  verifConfig:   path.join(DATA_DIR, 'verif_config.json'),    // config vérification
  blacklist:     path.join(DATA_DIR, 'blacklist.json'),        // liste noire
  pendingVerifs: path.join(DATA_DIR, 'pending_verifs.json'),   // demandes en attente
  badwords:      path.join(DATA_DIR, 'badwords.json'),         // mots interdits
  welcomeConf:   path.join(DATA_DIR, 'welcome_config.json'),   // message de bienvenue
  zyzzHonors:    path.join(DATA_DIR, 'zyzz_honors.json'),      // titres Zyzz
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ============================================================
//  HELPERS JSON LOCAUX
// ============================================================

function loadJSON(file, defaultVal) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error(`Erreur lecture ${file}:`, e.message); }
  return defaultVal;
}

function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error(`Erreur ecriture ${file}:`, e.message); }
}

// ============================================================
//  JSONBIN — BASE DE DONNÉES EN LIGNE
// ============================================================

let _binId = CONFIG.JSONBIN_BIN_ID || loadJSON(FILES.jsonbinId, {}).id || '';

const JSONBIN_HEADERS = () => ({
  'Content-Type':  'application/json',
  'X-Master-Key':  CONFIG.JSONBIN_MASTER_KEY,
  'X-Bin-Versioning': 'false',
});

const DEFAULT_GYMGIRLS = { girls: [], activeVotes: {} };

async function jsonbinGet() {
  if (!_binId) return { ...DEFAULT_GYMGIRLS };
  try {
    const res = await axios.get(`https://api.jsonbin.io/v3/b/${_binId}/latest`, {
      headers: JSONBIN_HEADERS(),
      timeout: 10000,
    });
    return res.data.record || { ...DEFAULT_GYMGIRLS };
  } catch (err) {
    console.error('[JSONBIN] Erreur GET :', err.message);
    return { ...DEFAULT_GYMGIRLS };
  }
}

async function jsonbinSet(data) {
  if (!CONFIG.JSONBIN_MASTER_KEY) {
    console.warn('[JSONBIN] Pas de Master Key configurée — données non sauvegardées en ligne.');
    return;
  }
  if (!_binId) {
    try {
      const res = await axios.post('https://api.jsonbin.io/v3/b', data, {
        headers: { ...JSONBIN_HEADERS(), 'X-Bin-Name': 'gymgirls-rating', 'X-Bin-Private': 'true' },
        timeout: 10000,
      });
      _binId = res.data.metadata.id;
      saveJSON(FILES.jsonbinId, { id: _binId });
      console.log(`[JSONBIN] Bin créé automatiquement : ${_binId}`);
    } catch (err) {
      console.error('[JSONBIN] Erreur création bin :', err.message);
    }
    return;
  }
  try {
    await axios.put(`https://api.jsonbin.io/v3/b/${_binId}`, data, {
      headers: JSONBIN_HEADERS(),
      timeout: 10000,
    });
  } catch (err) {
    console.error('[JSONBIN] Erreur PUT :', err.message);
  }
}

let _gymgirlsCache = null;
let _cacheTs       = 0;
const CACHE_TTL    = 30 * 1000;

async function getGymgirls() {
  if (_gymgirlsCache && Date.now() - _cacheTs < CACHE_TTL) return _gymgirlsCache;
  _gymgirlsCache = await jsonbinGet();
  _cacheTs       = Date.now();
  return _gymgirlsCache;
}

async function saveGymgirls(data) {
  _gymgirlsCache = data;
  _cacheTs       = Date.now();
  await jsonbinSet(data);
}

// ============================================================
//  DONNÉES LOCALES
// ============================================================

let studyData = loadJSON(FILES.study, {
  title: 'Aucune etude definie',
  url: '',
  description: 'Utilisez !def-etude pour definir une etude.',
  setBy: '',
  setAt: '',
});

let copesData = loadJSON(FILES.copes, {
  cope: ['Exemple Cope -- Inutile'],
  interesting: ['Exemple Interessant -- Peut etre utile'],
});

let rulesData = loadJSON(FILES.rules, {
  1: "Pas de demande de source : Il est interdit de demander, vendre ou partager des sources de steroides, peptides ou autres substances dopantes.",
  2: "Aucune discrimination : Les propos racistes, homophobes, sexistes ou discriminatoires sont strictement interdits sauf sur les iqlet.",
  3: "Respect obligatoire : Tout le monde doit etre respecte. Les insultes, provocations, harcelement ou comportements toxiques ne sont pas toleres sauf si la personne est sous systeme fluide.",
  4: "Pas de spam : Le spam, flood, messages repetes, ou abus de majuscules sont interdits.",
  5: "Publicite interdite : Pas de promotion de chaines, serveurs, produits ou services sans l'autorisation du staff.",
  6: "Contenu inapproprie : Les contenus NSFW, choquants ou illegaux sont interdits.",
  7: "Restez dans les bons salons : Merci d'utiliser les salons appropries pour chaque sujet.",
  8: "Respect du staff : Les decisions du staff doivent etre respectees.",
});

let liveStatus        = loadJSON(FILES.liveStatus,    { isLive: false, lastNotified: null });
let reactionRolesData = loadJSON(FILES.reactionRoles, {});
let ticketsData       = loadJSON(FILES.tickets,        {});
let warnsData         = loadJSON(FILES.warns,          {});
let jailsData         = loadJSON(FILES.jails,          {});
let sanctionLogData   = loadJSON(FILES.sanctionLog,    { channelId: null });
let npcList           = loadJSON(FILES.npcList,        {});
let tfList            = loadJSON(FILES.tfList,         {});
let tournamentsData   = loadJSON(FILES.tournaments,    {});

// ── VÉRIFICATION ──────────────────────────────────────────────
let verifConfig   = loadJSON(FILES.verifConfig, {
  pendingRoleId:  CONFIG.VERIF_PENDING_ROLE_ID  || '',
  approvedRoleId: CONFIG.VERIF_APPROVED_ROLE_ID || '',
  verifChannelId: CONFIG.VERIF_CHANNEL_ID       || '',
  logChannelId:   CONFIG.VERIF_LOG_CHANNEL_ID   || '',
  enabled:        false,
});
let blacklistData   = loadJSON(FILES.blacklist,     {});   // { userId: { reason, by, at } }
let pendingVerifs   = loadJSON(FILES.pendingVerifs, {});   // { userId: { logMessageId, ... } }
let badwordsData    = loadJSON(FILES.badwords,      { words: [] });
let welcomeConfig   = loadJSON(FILES.welcomeConf,   { channelId: null, message: null });
let zyzzHonors      = loadJSON(FILES.zyzzHonors,    {});   // { userId: { by, at } }

function saveVerifConfig()   { saveJSON(FILES.verifConfig,   verifConfig);   }
function saveBlacklist()     { saveJSON(FILES.blacklist,     blacklistData); }
function savePendingVerifs() { saveJSON(FILES.pendingVerifs, pendingVerifs); }
function saveBadwords()      { saveJSON(FILES.badwords,      badwordsData);  }
function saveWelcomeConf()   { saveJSON(FILES.welcomeConf,   welcomeConfig); }
function saveZyzzHonors()    { saveJSON(FILES.zyzzHonors,    zyzzHonors);    }

let ticketConfig = loadJSON(FILES.ticketConfig, {
  viewRoleId:  null,
  staffRoleId: null,
});

function saveReactionRoles() { saveJSON(FILES.reactionRoles, reactionRolesData); }
function saveTicketConfig()   { saveJSON(FILES.ticketConfig,  ticketConfig); }
function saveTickets()        { saveJSON(FILES.tickets,       ticketsData); }
function saveWarns()          { saveJSON(FILES.warns,         warnsData); }
function saveJails()          { saveJSON(FILES.jails,         jailsData); }
function saveSanctionLog()    { saveJSON(FILES.sanctionLog,   sanctionLogData); }
function saveNpcList()        { saveJSON(FILES.npcList,       npcList); }
function saveTfList()         { saveJSON(FILES.tfList,        tfList); }
function saveTournaments()    { saveJSON(FILES.tournaments,   tournamentsData); }

// ── LIKE AUTO ─────────────────────────────────────────────────
// ID du membre dont TOUS les messages sont likés automatiquement
const LIKE_TARGET_USER_ID = '980099925071241227';
let likeEnabled = false;   // activé/désactivé via !like-enable / !like-disable

// ── SONDAGES EN COURS ────────────────────────────────────────
// { messageId: { question, options: [{label, votes}], voters: Set } }
const activeSondages = {};

// ============================================================
//  CLIENT DISCORD
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

function isAdmin(userId)   { return CONFIG.ADMIN_IDS.includes(userId); }
function hasRatingRole(member) {
  return member.roles.cache.has(CONFIG.RATING_ROLE_ID) || isAdmin(member.id);
}
function embed(color = '#5865F2') { return new EmbedBuilder().setColor(color).setTimestamp(); }

// ============================================================
//  SANCTION LOG HELPER
// ============================================================

async function logSanction(guild, fields, title, color = '#FF4444') {
  if (!sanctionLogData.channelId) return;
  try {
    const logChannel = await guild.channels.fetch(sanctionLogData.channelId).catch(() => null);
    if (!logChannel) return;
    const e = embed(color).setTitle(`\uD83D\uDD10 ${title}`).addFields(fields).setFooter({ text: 'Sanction Log' });
    await logChannel.send({ embeds: [e] });
  } catch (err) {
    console.error('[SANCTION LOG] Erreur envoi log :', err.message);
  }
}

// ============================================================
//  VÉRIFICATION — HELPER PRINCIPAL
// ============================================================

/**
 * Calcule l'âge d'un compte en jours
 */
function accountAgeDays(userId) {
  const createdAt = Number(BigInt(userId) >> 22n) + 1420070400000;
  return Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
}

/**
 * Formate une durée en "X ans Y mois Z jours" pour l'affichage
 */
function formatAge(days) {
  if (days < 1)   return '< 1 jour 🚨';
  if (days < 7)   return `${days} jours 🚨`;
  if (days < 30)  return `${days} jours ⚠️`;
  if (days < 365) return `${Math.floor(days / 30)} mois ${days % 30} jours`;
  const years  = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return `${years} an${years > 1 ? 's' : ''} ${months > 0 ? months + ' mois' : ''}`;
}

/**
 * Envoie le message de vérification dans le channel log admin
 */
async function sendVerifRequest(guild, member) {
  if (!verifConfig.enabled || !verifConfig.logChannelId) return;

  const logChannel = guild.channels.cache.get(verifConfig.logChannelId);
  if (!logChannel) {
    console.error('[VERIF] Channel log introuvable :', verifConfig.logChannelId);
    return;
  }

  const ageDays    = accountAgeDays(member.id);
  const ageStr     = formatAge(ageDays);
  const isSuspect  = ageDays < 7;
  const joinedAt   = member.joinedAt
    ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
    : 'Inconnue';
  const createdAt  = new Date(Number(BigInt(member.id) >> 22n) + 1420070400000);
  const createdStr = `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`;
  const avatarUrl  = member.user.displayAvatarURL({ size: 256 });
  const hasAvatar  = !!member.user.avatar;

  // Fetch infos supplémentaires (MFA/A2F visible uniquement sur guild owner)
  // Pour les membres normaux, on peut voir si la guild requiert MFA
  const mfaRequired = guild.mfaLevel === 1;

  // Couleur selon suspicion
  const embedColor = isSuspect ? '#FF0000' : ageDays < 30 ? '#FFA500' : '#00C851';

  const flags = [];
  if (isSuspect) flags.push('🚨 **COMPTE RÉCENT** (< 7 jours)');
  if (!hasAvatar) flags.push('⚠️ Pas d\'avatar (compte par défaut)');
  if (mfaRequired) flags.push('ℹ️ Le serveur requiert la A2F');

  const flagsStr = flags.length > 0 ? flags.join('\n') : '✅ Aucun signal suspect';

  const verifEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${isSuspect ? '🚨' : '🔍'} Demande de vérification`)
    .setThumbnail(avatarUrl)
    .addFields(
      {
        name: '👤 Identité',
        value: [
          `**Pseudo** : ${member.user.tag}`,
          `**Surnom** : ${member.nickname || '*aucun*'}`,
          `**ID** : \`${member.id}\``,
          `**Mention** : <@${member.id}>`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '📅 Dates',
        value: [
          `**Compte créé le** : ${createdStr}`,
          `**Âge du compte** : ${ageStr}`,
          `**A rejoint le** : ${joinedAt}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🛡️ Signaux de sécurité',
        value: flagsStr,
        inline: false,
      },
      {
        name: '🎭 Avatar',
        value: hasAvatar ? `[Voir l'avatar](${avatarUrl})` : '❌ Avatar par défaut Discord',
        inline: true,
      },
      {
        name: '🤖 Bot ?',
        value: member.user.bot ? '✅ Oui (BOT)' : '❌ Non',
        inline: true,
      },
    )
    .setFooter({ text: `Demande reçue · ID ${member.id}` })
    .setTimestamp();

  // Boutons admin
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verif_approve_${member.id}`)
      .setLabel('✅  Approuver')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`verif_refuse_${member.id}`)
      .setLabel('❌  Refuser (kick)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`verif_blacklist_${member.id}`)
      .setLabel('🚫  Blacklist + Kick')
      .setStyle(ButtonStyle.Danger),
  );

  try {
    const logMsg = await logChannel.send({
      content: `${isSuspect ? '@here ' : ''}\`[VERIF]\` Nouveau membre en attente de vérification`,
      embeds: [verifEmbed],
      components: [row],
    });

    // Sauvegarder la demande en attente
    pendingVerifs[member.id] = {
      logMessageId: logMsg.id,
      logChannelId: verifConfig.logChannelId,
      userId:       member.id,
      tag:          member.user.tag,
      requestedAt:  new Date().toISOString(),
    };
    savePendingVerifs();

    console.log(`[VERIF] Demande envoyée pour ${member.user.tag} (${member.id})`);
  } catch (err) {
    console.error('[VERIF] Erreur envoi demande :', err.message);
  }
}

/**
 * Désactive les boutons d'un message de vérification
 */
async function disableVerifButtons(guild, userId, status) {
  const pending = pendingVerifs[userId];
  if (!pending) return;

  try {
    const ch  = guild.channels.cache.get(pending.logChannelId);
    if (!ch) return;
    const msg = await ch.messages.fetch(pending.logMessageId).catch(() => null);
    if (!msg) return;

    const statusColors  = { approved: ButtonStyle.Success, refused: ButtonStyle.Secondary, blacklisted: ButtonStyle.Secondary };
    const statusLabels  = { approved: '✅ Approuvé', refused: '❌ Refusé', blacklisted: '🚫 Blacklisté' };

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`verif_done_${userId}`)
        .setLabel(statusLabels[status] || 'Traité')
        .setStyle(statusColors[status] || ButtonStyle.Secondary)
        .setDisabled(true),
    );
    await msg.edit({ components: [disabledRow] }).catch(() => {});
  } catch (err) {
    console.error('[VERIF] Erreur désactivation boutons :', err.message);
  }
}

// ============================================================
//  HELPER — Met à jour l'embed du message RR
// ============================================================

async function updateRREmbed(targetMessage, rrEntry) {
  if (rrEntry.existingMessage) return;
  const rolesList = Object.entries(rrEntry.roles)
    .map(([emoji, roleId]) => `${emoji} -- <@&${roleId}>`)
    .join('\n') || '*Aucun role configure.*';
  const updatedEmbed = embed('#7289DA')
    .setTitle(`\uD83C\uDFAD ${rrEntry.titre}`)
    .setDescription(rrEntry.description)
    .addFields({ name: '\uD83D\uDCCB Roles disponibles', value: rolesList, inline: false })
    .setFooter({ text: 'Reagis pour obtenir un role - Retire ta reaction pour le perdre' });
  await targetMessage.edit({ embeds: [updatedEmbed] });
}

// ============================================================
//  JAIL HELPERS
// ============================================================

async function jailMember(member, reason) {
  const guild = member.guild;
  const rolesToRemove = member.roles.cache.filter(role =>
    role.id !== guild.id &&
    !CONFIG.JAIL_PROTECTED_ROLE_IDS.includes(role.id) &&
    role.managed === false
  );
  const removedRoleIds = rolesToRemove.map(r => r.id);
  if (removedRoleIds.length > 0) await member.roles.remove(rolesToRemove, reason);

  const channelPromises = guild.channels.cache
    .filter(ch => ch.id !== CONFIG.JAIL_PRISON_CHANNEL_ID && (ch.isTextBased() || ch.isVoiceBased()))
    .map(ch => ch.permissionOverwrites.edit(member.id, {
      ViewChannel: false, SendMessages: false, Connect: false,
    }, { reason }).catch(err => console.warn(`[JAIL] Impossible de modifier #${ch.name} : ${err.message}`)));
  await Promise.all(channelPromises);

  const prisonChannel = guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
  if (prisonChannel) {
    await prisonChannel.permissionOverwrites.edit(member.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    }, { reason }).catch(err => console.warn(`[JAIL] Impossible de modifier le salon prison : ${err.message}`));
  }

  console.log(`[JAIL] ${member.user.tag} verrouille -- ${removedRoleIds.length} roles retires.`);
  return removedRoleIds;
}

async function unjailMember(member, savedRoleIds, reason) {
  const guild = member.guild;
  const channelPromises = guild.channels.cache
    .filter(ch => ch.isTextBased() || ch.isVoiceBased())
    .map(ch => ch.permissionOverwrites.delete(member.id, reason).catch(() => {}));
  await Promise.all(channelPromises);

  const rolesToAdd = savedRoleIds
    .map(id => guild.roles.cache.get(id))
    .filter(Boolean)
    .filter(role => !member.roles.cache.has(role.id));
  if (rolesToAdd.length > 0) await member.roles.add(rolesToAdd, reason);

  console.log(`[JAIL] ${member.user.tag} libere -- ${rolesToAdd.length} role(s) restaure(s).`);
}

// ============================================================
//  TOURNOI — HELPERS
// ============================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(participants) {
  const shuffled = shuffle(participants);
  const pairs = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
  if (shuffled.length % 2 !== 0) pairs.push([shuffled[shuffled.length - 1], null]);
  return pairs;
}

async function sendVersus(channel, tournamentId, matchIndex, p1, p2) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tournament_${tournamentId}_${matchIndex}_A`).setLabel('\uD83C\uDFC6 Joueur A').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tournament_${tournamentId}_${matchIndex}_B`).setLabel('\uD83C\uDFC6 Joueur B').setStyle(ButtonStyle.Danger),
  );

  const versusEmbed = embed('#FFD700')
    .setTitle('\u2694\uFE0F VS -- Match ' + (matchIndex + 1))
    .setDescription('Qui a le meilleur physique ?')
    .addFields(
      { name: '\uD83C\uDD70\uFE0F ' + p1.username, value: `Soumis par <@${p1.userId}>`, inline: true },
      { name: '\u26A1 VS', value: '\u200b', inline: true },
      { name: '\uD83C\uDD71\uFE0F ' + p2.username, value: `Soumis par <@${p2.userId}>`, inline: true },
    )
    .setFooter({ text: `Tournoi #${tournamentId} -- Crous choisit le gagnant` });

  await channel.send({ content: `**Match ${matchIndex + 1}** -- \uD83C\uDD70\uFE0F **${p1.username}** vs \uD83C\uDD71\uFE0F **${p2.username}**` });
  await channel.send({ content: `\uD83C\uDD70\uFE0F **${p1.username}**`, files: [p1.imageUrl] }).catch(async () =>
    channel.send({ content: `\uD83C\uDD70\uFE0F **${p1.username}** -- (image : ${p1.imageUrl})` })
  );
  await channel.send({ content: `\uD83C\uDD71\uFE0F **${p2.username}**`, files: [p2.imageUrl] }).catch(async () =>
    channel.send({ content: `\uD83C\uDD71\uFE0F **${p2.username}** -- (image : ${p2.imageUrl})` })
  );

  const voteMsg = await channel.send({ embeds: [versusEmbed], components: [row] });
  return voteMsg.id;
}

// ============================================================
//  COMMANDES
// ============================================================

const commands = {

  // ── AIDE ────────────────────────────────────────────────────
  '!aide': async (message) => {
    const viewRoleDisplay  = ticketConfig.viewRoleId  ? `<@&${ticketConfig.viewRoleId}>`  : '`non défini`';
    const staffRoleDisplay = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '`non défini`';
    const logChDisplay     = sanctionLogData.channelId ? `<#${sanctionLogData.channelId}>` : '`non défini`';
    const guildIcon        = message.guild.iconURL({ size: 64 }) ?? undefined;

    // ── PAGE 1 : Général & Fun ───────────────────────────────
    const p1 = new EmbedBuilder()
      .setColor('#FF6B9D')
      .setAuthor({ name: '⚡ CrousBot — Centre de commandes', iconURL: guildIcon })
      .setTitle('📖 Commandes générales & Fun')
      .setDescription(
        '> Préfixe : **`!`**  ·  🔒 = admin uniquement  ·  🎭 = rôle requis\n' +
        '> ───────────────────────────────────────────────────'
      )
      .addFields(
        { name: '🔬 Études & Suppléments', value: [
            '`!pubmed` · Affiche la dernière étude enregistrée',
            '`!def-etude <titre> | <url> | <desc>` 🔒 · Définit une étude',
            '`!cope` · Liste complète des compléments classifiés',
            '`!cope-du-jour` · Cope aléatoire + réfutation scientifique',
            '`!add-cope <nom>` / `!remove-cope <nom>` 🔒',
            '`!add-interesting <nom>` / `!remove-interesting <nom>` 🔒',
            '`!set-cope-bulk <cope|interesting> | item1, item2` 🔒',
          ].join('\n'), inline: false },
        { name: '📜 Règles', value: [
            '`!regles` · Affiche toutes les règles',
            '`!regle<N>` · Affiche la règle N (ex: `!regle2`)',
            '`!set-regle <N> | <texte>` 🔒 · Modifie une règle',
          ].join('\n'), inline: false },
        { name: '🎭 Fun & Troll', value: [
            '`!iqtest [@user]` · Test de QI certifié fluide',
            '`!fluide @user` 🔒 · Place sous système fluide 24h',
            '`!tf @user` 🔒 · Renomme trollement 10 min',
            '`!npc @user` 🔒 · Déclare NPC pour 10 min',
            '`!resetpseudo @user` 🔒 · Réinitialise le surnom',
            '`!zyzz @user` 🔒 · Accorde / retire le titre "Fils de Zyzz"',
            '`!sondage <question> | <opt1> | <opt2> | [opt3] | [opt4]` · Vote public',
          ].join('\n'), inline: false },
        { name: '📡 TikTok Live', value:
            '`!live` · Vérifie manuellement si @crousgainz est en live',
          inline: false },
        { name: '🔧 Utilitaires', value: [
            '`!stats [@user]` · Fiche complète d\'un membre',
            '`!clear <N>` 🔒 · Supprime N messages (max 100)',
            '`!say <#channel> | <titre> | <desc> | [couleur] | [image] | [footer]` 🔒',
          ].join('\n'), inline: false },
      )
      .setFooter({ text: '!aide2 → Rating ELO · !aide3 → Tournoi · !aide4 → Modération · !aide5 → Tickets, RR & Vérif' })
      .setTimestamp();

    // ── PAGE 2 : Rating Gymgirl ──────────────────────────────
    const p2 = new EmbedBuilder()
      .setColor('#FFD700')
      .setAuthor({ name: '⚡ CrousBot — Centre de commandes', iconURL: guildIcon })
      .setTitle('🏆 Rating Gymgirl — Système ELO')
      .setDescription(
        '> Préfixe : **`!`**  ·  🔒 = admin  ·  🎭 = rôle Rating requis\n' +
        '> ───────────────────────────────────────────────────'
      )
      .addFields(
        { name: '🎭 Commandes publiques (rôle Rating)', value: [
            '`!rate` · Lance un duel ELO entre 2 gymgirls',
            '`!rate-top` · Classement ELO — Top 10',
          ].join('\n'), inline: false },
        { name: '🔒 Gestion admin', value: [
            '`!rate-list` · Liste complète avec scores et IDs',
            '`!rate-add <nom> | <url_image>` · Ajouter une gymgirl (ELO 1000)',
            '`!rate-remove <nom>` · Retirer une gymgirl',
            '`!rate-reset <nom>` · Réinitialiser l\'ELO à 1000',
            '`!give-rating @user` · Donner / retirer le rôle Rating',
          ].join('\n'), inline: false },
        { name: '⚙️ Fonctionnement', value: [
            '• Chaque duel met à jour les scores ELO en temps réel **(K=32)**',
            '• Les votes durent **5 minutes** puis expirent automatiquement',
            '• Plusieurs membres peuvent voter sur le même duel',
            '• 1 seul vote par utilisateur (changement autorisé)',
            '• Base de données stockée sur **JSONBin.io** — persistante cross-restart',
          ].join('\n'), inline: false },
      )
      .setFooter({ text: '!aide → Général · !aide3 → Tournoi · !aide4 → Modération · !aide5 → Tickets & Vérif' })
      .setTimestamp();

    // ── PAGE 3 : Tournoi ─────────────────────────────────────
    const p3 = new EmbedBuilder()
      .setColor('#F39C12')
      .setAuthor({ name: '⚡ CrousBot — Centre de commandes', iconURL: guildIcon })
      .setTitle('⚔️ Tournoi Physique — Élimination directe')
      .setDescription(
        '> Préfixe : **`!`**  ·  🔒 = admin uniquement\n' +
        '> ───────────────────────────────────────────────────'
      )
      .addFields(
        { name: '🔒 Commandes', value: [
            '`!tournoi-start <#channel-photos>` · Lance un tournoi depuis un salon photos',
            '`!tournoi-status` · État du tournoi (round, matchs, qualifiés)',
            '`!tournoi-cancel` · Annule le tournoi en cours',
          ].join('\n'), inline: false },
        { name: '⚙️ Fonctionnement', value: [
            '**1.** Scan du salon photos (jusqu\'à 1000 messages)',
            '**2.** 1 seule photo retenue par personne (première trouvée)',
            '**3.** Matchs générés aléatoirement par paires',
            '**4.** Vote via boutons **🏆 Joueur A / 🏆 Joueur B**',
            '**5.** Le gagnant avance — élimination directe',
            '**6.** Nombre impair → bye automatique (passage sans match)',
          ].join('\n'), inline: false },
      )
      .setFooter({ text: '!aide → Général · !aide2 → Rating · !aide4 → Modération · !aide5 → Tickets & Vérif' })
      .setTimestamp();

    // ── PAGE 4 : Modération ──────────────────────────────────
    const p4 = new EmbedBuilder()
      .setColor('#E74C3C')
      .setAuthor({ name: '⚡ CrousBot — Centre de commandes', iconURL: guildIcon })
      .setTitle('🔨 Modération — Commandes admin 🔒')
      .setDescription(
        '> Toutes les commandes ci-dessous sont réservées aux admins 🔒\n' +
        '> ───────────────────────────────────────────────────'
      )
      .addFields(
        { name: '⚠️ Warns', value: [
            '`!warn @user [raison]` · Avertit — jail auto au **3ème** warn',
            '`!warns @user` · Historique des warns d\'un membre',
            '`!clearwarns @user` · Supprime tous les warns',
          ].join('\n'), inline: false },
        { name: '🔒 Jail & Mute', value: [
            '`!jail @user` · Emprisonne 5 min (retire TOUS les rôles)',
            '`!unjail @user` · Libère avant la fin de la peine',
            '`!expiredjails` · Jails actifs avec temps restant',
            '`!mute @user <minutes> [raison]` · Timeout Discord (1–40320 min)',
          ].join('\n'), inline: false },
        { name: '⛔ Sanctions lourdes', value: [
            '`!ban @user [raison]` · Bannit définitivement + supprime 7j de messages',
            '`!source` · Auto-mute 10 min (règle 1 — sourceur détecté)',
            '`!mk677` · Auto-mute 10 min (règle 1 — mk677 mentionné)',
          ].join('\n'), inline: false },
        { name: '🛡️ Anti-Badwords', value: [
            '`!badwords-add <mot>` · Ajoute un mot interdit (suppression + warn auto)',
            '`!badwords-remove <mot>` · Retire un mot de la liste',
            '`!badwords-list` · Affiche tous les mots interdits',
          ].join('\n'), inline: false },
        { name: '📋 Logs & Divers', value: [
            '`!sanction-log <#channel>` · Définit le salon de logs',
            `> Salon actuel : ${logChDisplay}`,
            '`!like-enable` / `!like-disable` · Like auto sur cible configurée',
            '`!annonce-dm @role | <message>` · DM de masse avec confirmation',
            '  > Variables : `{user}` `{server}`',
            '`!welcome-set <#channel> | <message>` · Message de bienvenue auto',
            '  > Variables : `{user}` `{server}` `{count}`',
          ].join('\n'), inline: false },
      )
      .setFooter({ text: '!aide → Général · !aide2 → Rating · !aide3 → Tournoi · !aide5 → Tickets & Vérif' })
      .setTimestamp();

    // ── PAGE 5 : Tickets, Reaction Roles & Vérification ──────
    const p5 = new EmbedBuilder()
      .setColor('#2ECC71')
      .setAuthor({ name: '⚡ CrousBot — Centre de commandes', iconURL: guildIcon })
      .setTitle('🎫 Tickets · 🎭 Reaction Roles · ✅ Vérification')
      .setDescription(
        '> Préfixe : **`!`**  ·  🔒 = admin uniquement\n' +
        '> ───────────────────────────────────────────────────'
      )
      .addFields(
        { name: '🎫 Tickets', value: [
            '`!ticket <motif>` · Ouvre un ticket privé',
            '`!fermer` · Ferme le ticket (depuis le salon ticket)',
            '`!ticket-setrole @role` 🔒 · Rôle viewer (lecture seule)',
            '`!ticket-setstaff @role` 🔒 · Rôle staff (écriture)',
            '`!ticket-config` 🔒 · Configuration actuelle',
            `> Viewer : ${viewRoleDisplay}  ·  Staff : ${staffRoleDisplay}`,
          ].join('\n'), inline: false },
        { name: '🎭 Reaction Roles', value: [
            '`!rr-setup <#channel> | <titre> | <desc>` 🔒 · Crée un message RR',
            '`!rr-attach <msgID> <#channel> | <titre> | <desc>` 🔒 · Attache à un existant',
            '`!rr-add <msgID> | <emoji> | <@role>` 🔒 · Ajoute un emoji/rôle',
            '`!rr-remove <msgID> | <emoji>` 🔒 · Retire un emoji/rôle',
            '`!rr-list` 🔒 · Liste tous les messages RR configurés',
            '`!rr-delete <msgID>` 🔒 · Supprime un message RR',
            '`!clearrole` 🔒 · Retire le rôle accès à **tous** les membres',
          ].join('\n'), inline: false },
        { name: '✅ Vérification manuelle', value: [
            '`!verif-setup` 🔒 · Assistant de configuration',
            '`!verif-config` 🔒 · Affiche la configuration actuelle',
            '`!verif-enable` / `!verif-disable` 🔒 · Active ou désactive',
            '`!whitelist @user` 🔒 · Approuve directement un membre',
            '`!blacklist @user [raison]` 🔒 · Blacklist + kick',
            '`!unblacklist @user` 🔒 · Retire de la blacklist',
            '`!blacklist-list` 🔒 · Affiche toute la blacklist',
            '`!pending-list` 🔒 · Liste les vérifications en attente',
          ].join('\n'), inline: false },
        { name: '⚙️ Sécurité automatique', value: [
            '• Comptes blacklistés → rejetés automatiquement à la réaction',
            '• Comptes **< 7 jours** → signalés en rouge 🚨',
            '• Comptes **< 30 jours** → signalés en orange ⚠️',
            '• Sans avatar → signalé automatiquement',
          ].join('\n'), inline: false },
      )
      .setFooter({ text: '!aide → Général · !aide2 → Rating · !aide3 → Tournoi · !aide4 → Modération' })
      .setTimestamp();

    await message.reply({ embeds: [p1] });
    await message.channel.send({ embeds: [p2] });
    await message.channel.send({ embeds: [p3] });
    await message.channel.send({ embeds: [p4] });
    await message.channel.send({ embeds: [p5] });
  },

  '!aide2': async (message) => { await commands['!aide'](message); },
  '!aide3': async (message) => { await commands['!aide'](message); },
  '!aide4': async (message) => { await commands['!aide'](message); },
  '!aide5': async (message) => { await commands['!aide'](message); },

  // ── ZYZZ ─────────────────────────────────────────────────────
  '!zyzz': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!zyzz @user`');

    if (zyzzHonors[target.id]) {
      const honor = zyzzHonors[target.id];
      delete zyzzHonors[target.id];
      saveZyzzHonors();
      try {
        if ((target.nickname || '').startsWith('⚡ Fils de Zyzz')) {
          await target.setNickname(null, 'Retrait titre Zyzz').catch(() => {});
        }
      } catch {}
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle('☠️ Titre retiré — Fils de Zyzz')
        .setDescription(`<@${target.id}> n'est plus un **Fils de Zyzz**.\nLe soleil s'est couché sur son physique.`)
        .addFields(
          { name: 'Titre accordé le', value: new Date(honor.at).toLocaleDateString('fr-FR'), inline: true },
          { name: 'Retiré par',       value: `<@${message.author.id}>`,                      inline: true },
        )
        .setFooter({ text: 'We\'re all gonna make it... mais pas lui.' })
        .setTimestamp()] });
    }

    zyzzHonors[target.id] = { by: message.author.id, at: new Date().toISOString() };
    saveZyzzHonors();
    try {
      const base = target.nickname || target.user.username;
      await target.setNickname(`⚡ Fils de Zyzz | ${base}`.slice(0, 32), `Titre Zyzz par ${message.author.tag}`).catch(() => {});
    } catch {}
    await message.reply({ embeds: [new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('⚡ FILS DE ZYZZ — Titre accordé')
      .setDescription(
        `<@${target.id}> est désormais officiellement reconnu comme **Fils de Zyzz** par les dieux du physique.\n\n` +
        `*"We're all gonna make it, brah."*`
      )
      .addFields(
        { name: '🏅 Titre',        value: '⚡ Fils de Zyzz',             inline: true },
        { name: '👑 Accordé par',  value: `<@${message.author.id}>`,     inline: true },
      )
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: 'Héritier de la légende · Physique certifié divin' })
      .setTimestamp()] });
  },

  // ── BADWORDS-ADD ─────────────────────────────────────────────
  '!badwords-add': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const mot = args.join(' ').trim().toLowerCase();
    if (!mot) return message.reply('Format : `!badwords-add <mot>`');
    if (badwordsData.words.includes(mot)) return message.reply(`\`${mot}\` est déjà dans la liste.`);
    badwordsData.words.push(mot);
    saveBadwords();
    await message.reply({ embeds: [new EmbedBuilder()
      .setColor('#FF4444')
      .setTitle('⛔ Mot interdit ajouté')
      .setDescription(`Le mot \`${mot}\` est maintenant interdit. Tout message le contenant sera **supprimé** et un warn sera ajouté automatiquement.`)
      .addFields(
        { name: 'Mot ajouté',      value: `\`${mot}\``,                            inline: true },
        { name: 'Total interdits', value: `${badwordsData.words.length} mot(s)`,   inline: true },
        { name: 'Par',             value: `<@${message.author.id}>`,               inline: true },
      )
      .setFooter({ text: '!badwords-list pour voir la liste complète' })
      .setTimestamp()] });
  },

  // ── BADWORDS-REMOVE ──────────────────────────────────────────
  '!badwords-remove': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const mot = args.join(' ').trim().toLowerCase();
    if (!mot) return message.reply('Format : `!badwords-remove <mot>`');
    const idx = badwordsData.words.indexOf(mot);
    if (idx === -1) return message.reply(`\`${mot}\` n'est pas dans la liste des mots interdits.`);
    badwordsData.words.splice(idx, 1);
    saveBadwords();
    await message.reply({ embeds: [new EmbedBuilder()
      .setColor('#00FF66')
      .setTitle('✅ Mot retiré de la liste')
      .addFields(
        { name: 'Mot retiré', value: `\`${mot}\``,                            inline: true },
        { name: 'Restants',   value: `${badwordsData.words.length} mot(s)`,   inline: true },
      )
      .setTimestamp()] });
  },

  // ── BADWORDS-LIST ────────────────────────────────────────────
  '!badwords-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    if (badwordsData.words.length === 0) {
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor('#00FF66')
        .setTitle('✅ Aucun mot interdit configuré')
        .setDescription('Utilise `!badwords-add <mot>` pour en ajouter.')] });
    }
    const liste = badwordsData.words.map((w, i) => `\`${String(i + 1).padStart(2, '0')}\` ||${w}||`).join('\n');
    await message.reply({ embeds: [new EmbedBuilder()
      .setColor('#FF4444')
      .setTitle(`⛔ Mots interdits — ${badwordsData.words.length} entrée(s)`)
      .setDescription(liste.slice(0, 4000))
      .setFooter({ text: 'Mots masqués (spoiler) — clique pour révéler · !badwords-add / !badwords-remove' })
      .setTimestamp()] });
  },

  // ── ANNONCE-DM ───────────────────────────────────────────────
  '!annonce-dm': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!annonce-dm @role | <message>`\n> Variables : `{user}` `{server}`');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un rôle valide en premier paramètre.');
    const texte = parts.slice(1).join('|').trim();
    if (!texte) return message.reply('Le message ne peut pas être vide.');

    const confirmMsg = await message.reply({ embeds: [new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⚠️ Confirmation requise')
      .setDescription(
        `Tu es sur le point d'envoyer un DM à **tous les membres** avec le rôle <@&${role.id}>.\n\n**Aperçu du message :**\n> ${texte.slice(0, 400)}`
      )
      .setFooter({ text: 'Réagis ✅ pour confirmer ou ❌ pour annuler — 30 secondes' })] });

    await confirmMsg.react('✅').catch(() => {});
    await confirmMsg.react('❌').catch(() => {});

    const collected = await confirmMsg.awaitReactions({
      filter: (r, u) => ['✅', '❌'].includes(r.emoji.name) && u.id === message.author.id,
      max: 1, time: 30000,
    }).catch(() => null);

    if (!collected || collected.size === 0 || collected.first().emoji.name === '❌') {
      return confirmMsg.edit({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('❌ Annonce DM annulée')] });
    }

    await confirmMsg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📨 Envoi des DMs en cours...')] });
    await message.guild.members.fetch().catch(() => {});
    const targets = message.guild.members.cache.filter(m => !m.user.bot && m.roles.cache.has(role.id));

    let sent = 0, failed = 0;
    for (const [, member] of targets) {
      const personalizedMsg = texte
        .replace(/{user}/g,   member.user.username)
        .replace(/{server}/g, message.guild.name);
      try {
        await member.send({ embeds: [new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`📢 Message de ${message.guild.name}`)
          .setDescription(personalizedMsg)
          .setThumbnail(message.guild.iconURL({ size: 256 }) ?? undefined)
          .setTimestamp()
          .setFooter({ text: `Envoyé par ${message.author.tag}` })] });
        sent++;
      } catch { failed++; }
      await new Promise(r => setTimeout(r, 500));
    }

    await confirmMsg.edit({ embeds: [new EmbedBuilder()
      .setColor(failed > 0 ? '#FFA500' : '#00FF66')
      .setTitle('📨 Annonce DM terminée')
      .setDescription(`DMs envoyés aux membres avec le rôle <@&${role.id}>.`)
      .addFields(
        { name: '✅ Envoyés', value: `${sent}`,        inline: true },
        { name: '❌ Échecs',  value: `${failed}`,       inline: true },
        { name: 'Total',      value: `${targets.size}`, inline: true },
      )
      .setFooter({ text: 'Les DMs fermés comptent comme échecs.' })
      .setTimestamp()] });

    await logSanction(message.guild, [
      { name: 'Admin',   value: `<@${message.author.id}>`, inline: true },
      { name: 'Rôle',    value: `<@&${role.id}>`,          inline: true },
      { name: 'Envoyés', value: `${sent}/${targets.size}`, inline: true },
    ], 'Annonce DM de masse', '#5865F2');
  },

  // ── WELCOME-SET ──────────────────────────────────────────────
  '!welcome-set': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());

    if (!parts[0] || parts.length < 2) {
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor(welcomeConfig.channelId ? '#00FF66' : '#FF4444')
        .setTitle('🔔 Configuration — Bienvenue automatique')
        .setDescription(
          '**Format :** `!welcome-set <#channel> | <message>`\n' +
          '**Variables :** `{user}` → mention · `{server}` → nom du serveur · `{count}` → nb membres\n' +
          '**Désactiver :** `!welcome-set disable`\n\n**Configuration actuelle :**'
        )
        .addFields(
          { name: '📢 Salon',    value: welcomeConfig.channelId ? `<#${welcomeConfig.channelId}>` : '`Non configuré`', inline: true },
          { name: '💬 Message', value: welcomeConfig.message ? welcomeConfig.message.slice(0, 500) : '`Non configuré`', inline: false },
        )
        .setTimestamp()] });
    }

    if (parts[0].toLowerCase() === 'disable') {
      welcomeConfig.channelId = null; welcomeConfig.message = null; saveWelcomeConf();
      return message.reply({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('🔕 Message de bienvenue désactivé')] });
    }

    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('Mentionne un salon valide en premier paramètre.');
    const texte = parts.slice(1).join('|').trim();
    if (!texte) return message.reply('Le message ne peut pas être vide.');

    welcomeConfig.channelId = channel.id; welcomeConfig.message = texte; saveWelcomeConf();

    const preview = texte
      .replace(/{user}/g,   `<@${message.author.id}>`)
      .replace(/{server}/g, message.guild.name)
      .replace(/{count}/g,  message.guild.memberCount);

    await message.reply({ embeds: [new EmbedBuilder()
      .setColor('#00FF66')
      .setTitle('🔔 Message de bienvenue configuré ✅')
      .addFields(
        { name: '📢 Salon',    value: `${channel}`,            inline: true },
        { name: '👤 Aperçu', value: preview.slice(0, 500),     inline: false },
      )
      .setFooter({ text: 'Ce message sera envoyé automatiquement à chaque nouveau membre.' })
      .setTimestamp()] });
  },

  // ── CLEAR ────────────────────────────────────────────────────
  '!clear': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Specifie un nombre entre 1 et 100. Ex : `!clear 10`');
    try {
      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(amount, true);
      const confirm = await message.channel.send({
        embeds: [embed('#00FF66').setTitle('Messages supprimes')
          .setDescription(`**${deleted.size}** message(s) supprime(s) par <@${message.author.id}>.`)
          .setFooter({ text: 'Ce message disparait dans 5 secondes.' })],
      });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
    } catch (err) {
      const errMsg = await message.channel.send(`Erreur : ${err.message}`).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
    }
  },

  // ── SAY ──────────────────────────────────────────────────────
  '!say': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    try { await message.delete(); } catch {}
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) {
      const errMsg = await message.channel.send('Format : `!say <#channel> | <titre> | <description> | [couleur] | [image_url] | [footer]`');
      setTimeout(() => errMsg.delete().catch(() => {}), 8000);
      return;
    }
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) {
      const errMsg = await message.channel.send('Mentionne un salon valide en premier parametre.');
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }
    const titre       = parts[1] || 'Annonce';
    const description = parts[2] || '';
    const couleur     = parts[3] || '#5865F2';
    const imageUrl    = parts[4] || null;
    const footer      = parts[5] || null;
    const validColor  = /^#[0-9A-Fa-f]{6}$/.test(couleur) ? couleur : '#5865F2';
    const sayEmbed    = new EmbedBuilder().setColor(validColor).setTitle(titre).setDescription(description).setTimestamp();
    if (imageUrl) { try { sayEmbed.setImage(imageUrl); } catch {} }
    if (footer)   { sayEmbed.setFooter({ text: footer }); }
    try {
      await targetChannel.send({ embeds: [sayEmbed] });
    } catch (err) {
      const errMsg = await message.channel.send(`Impossible d'envoyer dans ce salon : ${err.message}`);
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
    }
  },

  // ── WARNS ────────────────────────────────────────────────────
  '!warn': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!warn @user [raison]`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas warn un admin.');

    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    if (!warnsData[target.id]) warnsData[target.id] = [];
    warnsData[target.id].push({ reason, by: message.author.id, at: new Date().toISOString() });
    saveWarns();

    const warnCount = warnsData[target.id].length;
    const warnEmbed = embed('#FFA500')
      .setTitle(`Avertissement -- Warn ${warnCount}/3`)
      .setDescription(`<@${target.id}> a recu un avertissement.`)
      .addFields(
        { name: 'Raison', value: reason,                    inline: false },
        { name: 'Par',    value: `<@${message.author.id}>`, inline: true  },
        { name: 'Total',  value: `${warnCount} warn(s)`,    inline: true  },
      )
      .setFooter({ text: warnCount >= 3 ? '3 warns atteints -- Jail automatique declenche !' : `${3 - warnCount} warn(s) avant jail automatique` });
    await message.reply({ embeds: [warnEmbed] });

    await logSanction(message.guild, [
      { name: 'Membre', value: `<@${target.id}>`,          inline: true },
      { name: 'Par',    value: `<@${message.author.id}>`,  inline: true },
      { name: 'Raison', value: reason,                     inline: false },
      { name: 'Total',  value: `${warnCount}/3`,           inline: true },
    ], `Warn #${warnCount} -- ${target.user.tag}`, '#FFA500');

    if (warnCount >= 3) {
      const prisonChannel = message.guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
      const dureeMin = Math.round(CONFIG.JAIL_DURATION_MS / 60000);
      try {
        const removedRoleIds = await jailMember(target, 'Auto-jail (3 warns)');
        jailsData[target.id] = { until: Date.now() + CONFIG.JAIL_DURATION_MS, savedRoleIds: removedRoleIds, hadRole: removedRoleIds.includes(CONFIG.JAIL_ACCESS_ROLE_ID), guildId: message.guild.id };
        saveJails();

        await message.channel.send({ embeds: [embed('#FF4444').setTitle('Jail automatique -- 3 warns atteints')
          .setDescription(`<@${target.id}> emprisonne pour **${dureeMin} minutes**. **${removedRoleIds.length}** role(s) retire(s).`)
          .setFooter({ text: 'Reflechis a tes actes.' })] });

        if (prisonChannel) {
          await prisonChannel.send({ content: `<@${target.id}>`, embeds: [embed('#FF4444').setTitle('Jail automatique')
            .setDescription(`Tu as accumule 3 warns. Tu es emprisonne pour **${dureeMin} min**.\nTu n'as acces qu'a ce salon. Tes roles seront restaures a la liberation.`)] });
        }

        await logSanction(message.guild, [
          { name: 'Membre',        value: `<@${target.id}>`,         inline: true },
          { name: 'Duree',         value: `${dureeMin} min`,          inline: true },
          { name: 'Roles retires', value: `${removedRoleIds.length}`, inline: true },
          { name: 'Motif',         value: 'Auto-jail (3 warns)',      inline: false },
        ], `Jail auto -- ${target.user.tag}`, '#FF4444');

        setTimeout(async () => {
          try {
            const member = await message.guild.members.fetch(target.id).catch(() => null);
            if (!member) { delete jailsData[target.id]; saveJails(); return; }
            const saved = jailsData[target.id];
            if (saved) await unjailMember(member, saved.savedRoleIds || [], 'Liberation automatique apres jail');
            delete jailsData[target.id]; saveJails();
            if (prisonChannel) {
              await prisonChannel.send({ embeds: [embed('#00FF66').setTitle('Libere !').setDescription(`<@${target.id}> a ete libere automatiquement. Ses roles ont ete restaures.`)] });
            }
          } catch (err) { console.error('[AUTO-JAIL] Erreur liberation :', err.message); }
        }, CONFIG.JAIL_DURATION_MS);
      } catch (err) { console.error('[WARN AUTO-JAIL] Erreur :', err.message); }
    }
  },

  '!warns': async (message) => {
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!warns @user`');
    const list = warnsData[target.id];
    if (!list || list.length === 0) return message.reply(`<@${target.id}> n'a aucun warn.`);
    const fields = list.map((w, i) => ({
      name: `Warn #${i + 1} -- ${new Date(w.at).toLocaleDateString('fr-FR')}`,
      value: `${w.reason}\n<@${w.by}>`,
      inline: false,
    }));
    await message.reply({ embeds: [embed('#FFA500').setTitle(`Warns de ${target.displayName} -- ${list.length}/3`).addFields(fields)] });
  },

  '!clearwarns': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!clearwarns @user`');
    const before = warnsData[target.id]?.length || 0;
    delete warnsData[target.id]; saveWarns();
    await message.reply(`**${before}** warn(s) supprime(s) pour <@${target.id}>.`);
    await logSanction(message.guild, [
      { name: 'Membre',    value: `<@${target.id}>`,          inline: true },
      { name: 'Par',       value: `<@${message.author.id}>`,  inline: true },
      { name: 'Supprimes', value: `${before} warn(s)`,        inline: true },
    ], `Warns effaces -- ${target.user.tag}`, '#00FF66');
  },

  // ── EXPIREDJAILS ─────────────────────────────────────────────
  '!expiredjails': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const active = Object.entries(jailsData);
    if (active.length === 0) return message.reply('Aucun jail actif en ce moment.');
    const now    = Date.now();
    const fields = active.map(([userId, data]) => {
      const remaining   = data.until - now;
      const displayTime = remaining > 0 ? `${Math.ceil(remaining / 1000 / 60)} min restante(s)` : 'Liberation en attente...';
      const rolesCount  = data.savedRoleIds?.length ?? (data.hadRole ? 1 : 0);
      return { name: `<@${userId}>`, value: `${displayTime}\nFin : ${new Date(data.until).toLocaleTimeString('fr-FR')}\n${rolesCount} role(s) sauvegarde(s)`, inline: true };
    });
    await message.reply({ embeds: [embed('#FF4444').setTitle(`Jails actifs -- ${active.length} membre(s)`).addFields(fields)] });
  },

  // ── SANCTION LOG ─────────────────────────────────────────────
  '!sanction-log': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('Mentionne un salon : `!sanction-log <#channel>`');
    sanctionLogData.channelId = channel.id; saveSanctionLog();
    await message.reply(`Salon de logs des sanctions defini : ${channel}`);
  },

  // ── JAIL ─────────────────────────────────────────────────────
  '!jail': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!jail @user`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas emprisonner un admin.');

    const prisonChannel = message.guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
    const prisonMention = prisonChannel ? `<#${CONFIG.JAIL_PRISON_CHANNEL_ID}>` : '#prison';
    const dureeMin      = Math.round(CONFIG.JAIL_DURATION_MS / 60000);

    try {
      const removedRoleIds = await jailMember(target, `Jail par ${message.author.tag}`);
      jailsData[target.id] = { until: Date.now() + CONFIG.JAIL_DURATION_MS, savedRoleIds: removedRoleIds, hadRole: removedRoleIds.includes(CONFIG.JAIL_ACCESS_ROLE_ID), guildId: message.guild.id };
      saveJails();

      await message.reply({ embeds: [embed('#FF4444').setTitle('Emprisonne !')
        .setDescription(`<@${target.id}> envoye en prison par <@${message.author.id}>.\n**${removedRoleIds.length}** role(s) retire(s) -- restaures dans **${dureeMin} min**.\n\nSeul ${prisonMention} reste accessible.`)
        .addFields(
          { name: 'Par',           value: `<@${message.author.id}>`, inline: true },
          { name: 'Duree',         value: `${dureeMin} min`,          inline: true },
          { name: 'Roles retires', value: `${removedRoleIds.length}`, inline: true },
        ).setFooter({ text: 'Reflechis a tes actes.' })] });

      if (prisonChannel) {
        await prisonChannel.send({ content: `<@${target.id}>`, embeds: [embed('#FF4444').setTitle('Tu es en prison')
          .setDescription(`Tu as ete emprisonne par <@${message.author.id}>.\nTu n'as acces qu'a ce salon pendant **${dureeMin} minute${dureeMin > 1 ? 's' : ''}**.\nTous tes roles seront restaures a la liberation.`)] });
      }

      await logSanction(message.guild, [
        { name: 'Membre',        value: `<@${target.id}>`,          inline: true },
        { name: 'Par',           value: `<@${message.author.id}>`,  inline: true },
        { name: 'Duree',         value: `${dureeMin} min`,           inline: true },
        { name: 'Roles retires', value: `${removedRoleIds.length}`, inline: true },
      ], `Jail -- ${target.user.tag}`, '#FF4444');

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete jailsData[target.id]; saveJails(); return; }
          const saved = jailsData[target.id];
          if (saved) await unjailMember(member, saved.savedRoleIds || [], 'Liberation automatique apres jail');
          delete jailsData[target.id]; saveJails();
          if (prisonChannel) {
            await prisonChannel.send({ embeds: [embed('#00FF66').setTitle('Libere !').setDescription(`<@${target.id}> a purge sa peine. Tous ses roles ont ete restaures.`)] });
          }
        } catch (err) { console.error('[JAIL] Erreur liberation :', err.message); }
      }, CONFIG.JAIL_DURATION_MS);
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // ── TOURNOI ──────────────────────────────────────────────────
  '!tournoi-start': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const photoChannel = message.mentions.channels.first();
    if (!photoChannel) return message.reply('Mentionne le salon photos : `!tournoi-start <#channel-photos>`');

    const activeTournament = Object.values(tournamentsData).find(t => t.status === 'active');
    if (activeTournament) return message.reply(`Un tournoi est deja en cours (ID: \`${activeTournament.id}\`). Utilise \`!tournoi-cancel\` pour l'annuler.`);

    await message.reply('Recuperation des photos en cours...');

    let allMessages = []; let lastId = null; let fetchMore = true;
    while (fetchMore) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const batch = await photoChannel.messages.fetch(options).catch(() => null);
      if (!batch || batch.size === 0) break;
      allMessages.push(...batch.values());
      lastId = batch.last().id;
      fetchMore = batch.size === 100;
      if (allMessages.length >= 1000) break;
    }

    const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
    const participants = []; const seenUsers = new Set();
    for (const msg of allMessages) {
      if (msg.author.bot) continue;
      const imageAttachment = msg.attachments.find(att => att.contentType?.startsWith('image/') || imageExtensions.test(att.url));
      if (imageAttachment && !seenUsers.has(msg.author.id)) {
        seenUsers.add(msg.author.id);
        participants.push({ userId: msg.author.id, username: msg.member?.displayName || msg.author.username, imageUrl: imageAttachment.url, messageId: msg.id });
      }
    }

    if (participants.length < 2) return message.reply('Pas assez de participants (minimum 2).');

    const tournamentId = Date.now().toString(36);
    const firstRoundPairs = buildRound(participants);
    tournamentsData[tournamentId] = {
      id: tournamentId, status: 'active', hostChannelId: message.channel.id, photoChannelId: photoChannel.id,
      participants, currentRound: 1, currentMatchIndex: 0, currentPairs: firstRoundPairs,
      roundWinners: [], allRoundWinners: [], history: [], startedBy: message.author.id,
      startedAt: new Date().toISOString(), currentVoteMessageId: null,
    };
    saveTournaments();

    await message.channel.send({ embeds: [embed('#FFD700').setTitle('Tournoi Physique -- Debut !')
      .setDescription(`Le tournoi demarre avec **${participants.length} participant(s)** !\n\nPhotos recuperees depuis ${photoChannel}\nSeule **1 photo par personne** est retenue.`)
      .addFields(
        { name: 'Participants',       value: participants.map(p => `<@${p.userId}>`).join(', ').slice(0, 1024), inline: false },
        { name: 'Matchs au 1er tour', value: `${firstRoundPairs.filter(p => p[1] !== null).length} match(s)`,   inline: true  },
        { name: 'Format',             value: 'Elimination directe',                                               inline: true  },
      ).setFooter({ text: `Tournoi #${tournamentId} -- Lance par ${message.author.tag}` })] });
    await advanceTournament(tournamentId, message.channel);
  },

  '!tournoi-status': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const activeTournament = Object.values(tournamentsData).find(t => t.status === 'active');
    if (!activeTournament) return message.reply('Aucun tournoi en cours.');
    const t = activeTournament;
    await message.reply({ embeds: [embed('#FFD700').setTitle(`Tournoi #${t.id} -- Round ${t.currentRound}`).addFields(
      { name: 'Progression',                         value: `Match ${t.currentMatchIndex}/${t.currentPairs.filter(p => p[1] !== null).length}`, inline: true },
      { name: 'Participants',                        value: `${t.participants.length}`,                                                          inline: true },
      { name: `Qualifies (R${t.currentRound})`,     value: `${t.roundWinners.length}`,                                                          inline: true },
      { name: 'Lance par',                           value: `<@${t.startedBy}>`,                                                                 inline: true },
      { name: 'Demarre le',                          value: new Date(t.startedAt).toLocaleString('fr-FR'),                                       inline: true },
    )] });
  },

  '!tournoi-cancel': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const activeTournament = Object.values(tournamentsData).find(t => t.status === 'active');
    if (!activeTournament) return message.reply('Aucun tournoi en cours.');
    activeTournament.status = 'cancelled'; saveTournaments();
    await message.reply({ embeds: [embed('#FF4444').setTitle('Tournoi annule').setDescription(`Le tournoi #${activeTournament.id} a ete annule par <@${message.author.id}>.`)] });
  },

  // ── NPC ──────────────────────────────────────────────────────
  '!npc': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!npc @user`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas npc-ifier un admin.');

    const NPC_DURATION_MS = 10 * 60 * 1000;
    const dureeMin = Math.round(NPC_DURATION_MS / 60000);
    const originalNick = target.nickname || target.user.username;
    const npcNames = ['NPC #4782', 'NPC #0001', 'NPC Villageois', 'NPC Background', 'NPC Sans Cerveau', 'NPC Scriptless', 'NPC Fluide', 'NPC Cope Dealer'];
    const newNick = npcNames[Math.floor(Math.random() * npcNames.length)];

    try {
      await target.setNickname(newNick, `NPC par ${message.author.tag}`);
      npcList[target.id] = { originalNick, until: Date.now() + NPC_DURATION_MS, guildId: message.guild.id }; saveNpcList();
      await message.reply({ embeds: [embed('#95A5A6').setTitle('Statut NPC active')
        .setDescription(`<@${target.id}> est desormais un **NPC** pour les **${dureeMin} prochaines minutes**.`)
        .addFields(
          { name: 'Nouveau pseudo', value: newNick,                    inline: true },
          { name: 'Par',            value: `<@${message.author.id}>`,  inline: true },
          { name: 'Duree',          value: `${dureeMin} min`,           inline: true },
        ).setFooter({ text: 'NPC Mode -- Retour a la conscience dans quelques minutes.' })] });
      await logSanction(message.guild, [
        { name: 'Membre', value: `<@${target.id}>`,         inline: true },
        { name: 'Par',    value: `<@${message.author.id}>`, inline: true },
        { name: 'Duree',  value: `${dureeMin} min`,          inline: true },
      ], `NPC -- ${target.user.tag}`, '#95A5A6');
      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete npcList[target.id]; saveNpcList(); return; }
          const saved = npcList[target.id];
          await member.setNickname(saved?.originalNick === target.user.username ? null : saved?.originalNick, 'Fin du statut NPC');
          delete npcList[target.id]; saveNpcList();
        } catch (err) { console.error('[NPC] Erreur restauration pseudo :', err.message); }
      }, NPC_DURATION_MS);
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // ── RESETPSEUDO ──────────────────────────────────────────────
  '!resetpseudo': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!resetpseudo @user`');
    try {
      const oldNick = target.nickname || '*aucun surnom*';
      await target.setNickname(null, `Reset pseudo par ${message.author.tag}`);
      if (npcList[target.id]) { delete npcList[target.id]; saveNpcList(); }
      if (tfList[target.id])  { delete tfList[target.id];  saveTfList();  }
      await message.reply({ embeds: [embed('#00FF66').setTitle('Pseudo reinitialise').addFields(
        { name: 'Membre',        value: `<@${target.id}>`,         inline: true },
        { name: 'Ancien pseudo', value: oldNick,                    inline: true },
        { name: 'Par',           value: `<@${message.author.id}>`, inline: true },
      )] });
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // ── TF ───────────────────────────────────────────────────────
  '!tf': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!tf @user`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas transformer un admin.');

    const TF_DURATION_MS = 10 * 60 * 1000;
    const dureeMin = Math.round(TF_DURATION_MS / 60000);
    const originalNick = target.nickname || target.user.username;
    const tfNames = ['Le Copeur Certifie', 'M. Fluide 2024', 'Natty Suspect #1', 'Le Roi du Fenugrec', 'Monsieur Maingain', 'Le Bulk Eternel', 'Prince du Cope', 'IQ Test Echoue', 'Fonte Imaginaire', 'Background NPC', 'Zyzz Rate', 'Le Sourceur', 'Hgh Anonymous', 'Mr. Overdose Creatine', 'Amateur de MK677'];
    const newNick = tfNames[Math.floor(Math.random() * tfNames.length)];

    try {
      await target.setNickname(newNick, `TF par ${message.author.tag}`);
      tfList[target.id] = { originalNick, until: Date.now() + TF_DURATION_MS, guildId: message.guild.id }; saveTfList();
      await message.reply({ embeds: [embed('#9B59B6').setTitle('Transformation activee')
        .setDescription(`<@${target.id}> a ete transforme pour **${dureeMin} minutes**.`)
        .addFields(
          { name: 'Ancien pseudo',  value: originalNick,              inline: true },
          { name: 'Nouveau pseudo', value: newNick,                   inline: true },
          { name: 'Par',            value: `<@${message.author.id}>`, inline: true },
          { name: 'Duree',          value: `${dureeMin} min`,          inline: true },
        ).setFooter({ text: 'TF Mode -- Identite temporairement confisquee.' })] });
      await logSanction(message.guild, [
        { name: 'Membre',         value: `<@${target.id}>`,         inline: true },
        { name: 'Nouveau pseudo', value: newNick,                   inline: true },
        { name: 'Par',            value: `<@${message.author.id}>`, inline: true },
      ], `TF -- ${target.user.tag}`, '#9B59B6');
      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete tfList[target.id]; saveTfList(); return; }
          const saved = tfList[target.id];
          await member.setNickname(saved?.originalNick === target.user.username ? null : saved?.originalNick, 'Fin du TF');
          delete tfList[target.id]; saveTfList();
        } catch (err) { console.error('[TF] Erreur restauration pseudo :', err.message); }
      }, TF_DURATION_MS);
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // ── TICKETS ──────────────────────────────────────────────────
  '!ticket-setrole': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un role. Exemple : `!ticket-setrole @Membres`');
    ticketConfig.viewRoleId = role.id; saveTicketConfig();
    await message.reply(`Role viewer des tickets defini : <@&${role.id}>`);
  },

  '!ticket-setstaff': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un role. Exemple : `!ticket-setstaff @Staff`');
    ticketConfig.staffRoleId = role.id; saveTicketConfig();
    await message.reply(`Role staff des tickets defini : <@&${role.id}>`);
  },

  '!ticket-config': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    await message.reply({ embeds: [embed('#00FF66').setTitle('Configuration des tickets').addFields(
      { name: 'Role viewer', value: ticketConfig.viewRoleId  ? `<@&${ticketConfig.viewRoleId}>`  : 'Non defini', inline: false },
      { name: 'Role staff',  value: ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : 'Non defini', inline: false },
    )] });
  },

  '!ticket': async (message, args) => {
    try { await message.delete(); } catch {}
    const motif = args.join(' ').trim();
    if (!motif) {
      const errMsg = await message.channel.send('Format : `!ticket <motif>`').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
      return;
    }
    const guild = message.guild;
    const ticketNumber = Math.floor(1000 + Math.random() * 9000);
    const overwrites = [{ id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }];
    if (ticketConfig.viewRoleId) {
      const viewRole = guild.roles.cache.get(ticketConfig.viewRoleId);
      if (viewRole) overwrites.push({ id: viewRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });
    }
    if (ticketConfig.staffRoleId) {
      const staffRole = guild.roles.cache.get(ticketConfig.staffRoleId);
      if (staffRole) overwrites.push({ id: staffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
    }
    overwrites.push({ id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
    for (const adminId of CONFIG.ADMIN_IDS) {
      try {
        const adminMember = await guild.members.fetch(adminId);
        if (adminMember) overwrites.push({ id: adminMember.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
      } catch { console.warn(`[TICKET] Admin ${adminId} introuvable, ignore.`); }
    }
    try {
      const channel = await guild.channels.create({ name: `ticket-${ticketNumber}`, type: 0, permissionOverwrites: overwrites, reason: `Ticket #${ticketNumber} ouvert par ${message.author.tag}` });
      ticketsData[channel.id] = { openerId: message.author.id, openerTag: message.author.tag, ticketNumber, motif, openedAt: new Date().toISOString() }; saveTickets();
      const staffMention = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '';
      await channel.send({ content: `<@${message.author.id}>${staffMention ? ` ${staffMention}` : ''}`,
        embeds: [embed('#00FF66').setTitle(`Ticket #${ticketNumber}`)
          .setDescription('Le staff va traiter ta demande sous 24h.\n\n> Pour fermer ce ticket, utilise `!fermer`')
          .addFields({ name: 'Ouvert par', value: `<@${message.author.id}>`, inline: true }, { name: 'Motif', value: motif, inline: false })
          .setFooter({ text: `Ticket #${ticketNumber}` })] });
      const confirmMsg = await message.channel.send(`Ton ticket a ete cree : ${channel}`).catch(() => null);
      if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => {}), 6000);
    } catch (error) {
      const errMsg = await message.channel.send(`Impossible de creer le ticket : ${error.message}`).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
    }
  },

  '!fermer': async (message) => {
    try { await message.delete(); } catch {}
    const ticketInfo = ticketsData[message.channel.id];
    if (!ticketInfo) {
      const errMsg = await message.channel.send('Cette commande ne peut etre utilisee que dans un salon ticket.').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }
    const canClose = isAdmin(message.author.id) || message.author.id === ticketInfo.openerId;
    if (!canClose) {
      const errMsg = await message.channel.send('Seul le staff ou la personne qui a ouvert ce ticket peut le fermer.').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }
    await message.channel.send({ embeds: [embed('#FF4444').setTitle('Ticket ferme')
      .setDescription(`Ce ticket a ete ferme par <@${message.author.id}>.\n\nLe salon sera supprime dans **5 secondes**.`)
      .addFields({ name: 'Ouvert par', value: `<@${ticketInfo.openerId}>`, inline: true }, { name: 'Motif', value: ticketInfo.motif, inline: false })
      .setFooter({ text: `Ticket #${ticketInfo.ticketNumber}` })] }).catch(() => {});
    delete ticketsData[message.channel.id]; saveTickets();
    setTimeout(async () => { try { await message.channel.delete(`Ticket ferme par ${message.author.tag}`); } catch (err) { console.error('[FERMER] Erreur suppression salon :', err.message); } }, 5000);
  },

  // ── REACTION ROLES ───────────────────────────────────────────
  '!rr-setup': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!rr-setup <#channel> | <titre> | <description (optionnelle)>`');
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) return message.reply('Mentionne un channel valide.');
    const titre       = parts[1];
    const description = parts[2] || 'Reagis avec les emojis ci-dessous pour obtenir tes roles !';
    const sent = await targetChannel.send({ embeds: [embed('#7289DA').setTitle(titre).setDescription(description)
      .addFields({ name: 'Roles disponibles', value: '*Aucun role configure pour l\'instant.*', inline: false })
      .setFooter({ text: 'Reagis pour obtenir un role - Retire ta reaction pour le perdre' })] });
    reactionRolesData[sent.id] = { channelId: targetChannel.id, titre, description, roles: {}, existingMessage: false }; saveReactionRoles();
    await message.reply(`Message de reaction role cree dans ${targetChannel} !\nID : \`${sent.id}\``);
  },

  '!rr-attach': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!rr-attach <messageID> <#channel> | <titre> | <description optionnelle>`');
    const firstPartTokens = parts[0].split(/\s+/);
    if (firstPartTokens.length < 2) return message.reply('Tu dois fournir le **messageID** ET mentionner le **#channel**.');
    const messageId     = firstPartTokens[0];
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) return message.reply('Mentionne le salon ou se trouve le message.');
    const titre       = parts[1] || 'Reaction Roles';
    const description = parts[2] || 'Reagis pour obtenir un role !';
    let targetMessage;
    try { targetMessage = await targetChannel.messages.fetch(messageId); }
    catch { return message.reply(`Message introuvable avec l'ID \`${messageId}\` dans ${targetChannel}.`); }
    if (reactionRolesData[messageId]) return message.reply('Ce message est deja enregistre comme reaction role.');
    reactionRolesData[messageId] = { channelId: targetChannel.id, titre, description, roles: {}, existingMessage: true }; saveReactionRoles();
    await message.reply(`Message \`${messageId}\` enregistre comme reaction role dans ${targetChannel} !`);
  },

  '!rr-add': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) return message.reply('Format : `!rr-add <messageID> | <emoji> | <@role>`');
    const messageId = parts[0]; const emoji = parts[1];
    const role = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un role valide.');
    if (!reactionRolesData[messageId]) return message.reply(`Message introuvable avec l'ID \`${messageId}\`.`);
    const rrEntry = reactionRolesData[messageId];
    if (rrEntry.roles[emoji]) return message.reply(`L'emoji ${emoji} est deja utilise.`);
    try {
      const targetChannel = await client.channels.fetch(rrEntry.channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      await targetMessage.react(emoji);
      rrEntry.roles[emoji] = role.id; saveReactionRoles();
      if (!rrEntry.existingMessage) await updateRREmbed(targetMessage, rrEntry);
      await message.reply(`${emoji} -> <@&${role.id}> ajoute !`);
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  '!rr-remove': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!rr-remove <messageID> | <emoji>`');
    const [messageId, emoji] = parts;
    if (!reactionRolesData[messageId]) return message.reply(`Message introuvable avec l'ID \`${messageId}\`.`);
    if (!reactionRolesData[messageId].roles[emoji]) return message.reply(`L'emoji ${emoji} n'est pas configure.`);
    try {
      const targetChannel = await client.channels.fetch(reactionRolesData[messageId].channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji);
      if (reaction) await reaction.remove();
      delete reactionRolesData[messageId].roles[emoji]; saveReactionRoles();
      if (!reactionRolesData[messageId].existingMessage) await updateRREmbed(targetMessage, reactionRolesData[messageId]);
      await message.reply(`Emoji ${emoji} retire.`);
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  '!rr-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const entries = Object.entries(reactionRolesData);
    if (entries.length === 0) return message.reply('Aucun message de reaction role configure.');
    const fields = entries.map(([msgId, data]) => ({
      name: `${data.existingMessage ? 'Existant' : 'Nouveau'} "${data.titre}" -- \`${msgId}\``,
      value: [`Salon : <#${data.channelId}>`, Object.entries(data.roles).map(([e, r]) => `${e} -> <@&${r}>`).join('\n') || '*Aucun role*'].join('\n'),
      inline: false,
    }));
    await message.reply({ embeds: [embed('#7289DA').setTitle('Reaction Roles configures').addFields(fields)] });
  },

  '!rr-delete': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const messageId = args[0];
    if (!messageId) return message.reply('Format : `!rr-delete <messageID>`');
    if (!reactionRolesData[messageId]) return message.reply(`Message introuvable avec l'ID \`${messageId}\`.`);
    const rrEntry = reactionRolesData[messageId];
    try {
      const targetChannel = await client.channels.fetch(rrEntry.channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      if (rrEntry.existingMessage) {
        for (const emoji of Object.keys(rrEntry.roles)) {
          try { const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji); if (reaction) await reaction.users.remove(client.user.id); } catch {}
        }
      } else { await targetMessage.delete(); }
    } catch { console.warn('[RR-DELETE] Message introuvable ou deja supprime.'); }
    delete reactionRolesData[messageId]; saveReactionRoles();
    await message.reply(rrEntry.existingMessage ? `Config RR retiree du message \`${messageId}\` (message original conserve).` : `Message RR \`${messageId}\` supprime.`);
  },

  // ── ETUDES / PUBMED ──────────────────────────────────────────
  '!pubmed': async (message) => {
    const fields = [{ name: 'Titre', value: studyData.title || 'Non defini', inline: false }];
    if (studyData.url)   fields.push({ name: 'Lien',        value: studyData.url,           inline: false });
    if (studyData.setBy) fields.push({ name: 'Definie par', value: `<@${studyData.setBy}>`, inline: true  });
    if (studyData.setAt) fields.push({ name: 'Date',        value: studyData.setAt,         inline: true  });
    await message.reply({ embeds: [embed('#00B5D8').setTitle('Derniere etude partagee').setDescription(studyData.description || 'Aucune description.').addFields(fields)] });
  },

  '!def-etude': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!def-etude <titre> | <url> | <description>`');
    studyData = { title: parts[0] || 'Sans titre', url: parts[1] || '', description: parts[2] || '', setBy: message.author.id, setAt: new Date().toLocaleDateString('fr-FR') };
    saveJSON(FILES.study, studyData);
    await message.reply(`Etude mise a jour : **${studyData.title}**`);
  },

  // ── COPE ─────────────────────────────────────────────────────
  '!cope': async (message) => {
    const copeList        = copesData.cope.length        > 0 ? copesData.cope.map((c, i)        => `${i + 1}. ${c}`).join('\n') : '*Aucun complement.*';
    const interestingList = copesData.interesting.length > 0 ? copesData.interesting.map((c, i) => `${i + 1}. ${c}`).join('\n') : '*Aucun complement.*';
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('Liste des complements').addFields(
      { name: 'COPE (Inutiles)', value: copeList.slice(0, 1024),        inline: false },
      { name: 'Interessants',    value: interestingList.slice(0, 1024), inline: false },
    ).setFooter({ text: `${copesData.cope.length} cope(s) | ${copesData.interesting.length} interessant(s)` })] });
  },

  '!add-cope':        async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim(); if (!name) return message.reply('Format : `!add-cope <nom>`');
    if (copesData.cope.includes(name)) return message.reply('Deja dans la liste Cope.');
    copesData.cope.push(name); saveJSON(FILES.copes, copesData); await message.reply(`**${name}** ajoute a la liste Cope.`);
  },
  '!add-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim(); if (!name) return message.reply('Format : `!add-interesting <nom>`');
    if (copesData.interesting.includes(name)) return message.reply('Deja dans la liste Interessants.');
    copesData.interesting.push(name); saveJSON(FILES.copes, copesData); await message.reply(`**${name}** ajoute a la liste Interessants.`);
  },
  '!remove-cope':     async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim(); const idx = copesData.cope.indexOf(name);
    if (idx === -1) return message.reply(`**${name}** introuvable dans Cope.`);
    copesData.cope.splice(idx, 1); saveJSON(FILES.copes, copesData); await message.reply(`**${name}** retire de la liste Cope.`);
  },
  '!remove-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim(); const idx = copesData.interesting.indexOf(name);
    if (idx === -1) return message.reply(`**${name}** introuvable dans Interessants.`);
    copesData.interesting.splice(idx, 1); saveJSON(FILES.copes, copesData); await message.reply(`**${name}** retire de la liste Interessants.`);
  },

  // ── REGLES ───────────────────────────────────────────────────
  '!regles': async (message) => {
    const rulesList = Object.entries(rulesData).sort(([a], [b]) => Number(a) - Number(b)).map(([n, text]) => `**${n}.** ${text}`).join('\n');
    await message.reply({ embeds: [embed('#FAD961').setTitle('Regles du serveur').setDescription(rulesList || '*Aucune regle definie.*')] });
  },
  '!set-regle': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2 || isNaN(Number(parts[0]))) return message.reply('Format : `!set-regle <numero> | <texte>`');
    rulesData[parts[0]] = parts[1]; saveJSON(FILES.rules, rulesData); await message.reply(`Regle **${parts[0]}** mise a jour.`);
  },

  // ── MODERATION ───────────────────────────────────────────────
  '!source': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !source -- CF : regle 1.');
      await message.reply({ embeds: [embed('#FFA500').setTitle('Mute automatique').setDescription(`<@${message.author.id}> a ete mute pendant 10 minutes.\n\n**CF : regle 1.**`)] });
    } catch (err) { await message.reply(`Impossible de muter : ${err.message}`); }
  },
  '!mk677': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !mk677 -- CF : regle 1.');
      await message.reply({ embeds: [embed('#FF4444').setTitle('Mute automatique (mk677)').setDescription(`<@${message.author.id}> a ete mute pendant 10 minutes.\n\n**CF : regle 1.**`)] });
    } catch (err) { await message.reply(`Impossible de muter : ${err.message}`); }
  },
  '!ban': async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('Tu n\'as pas la permission de bannir des membres.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur a bannir : `!ban @user [raison]`');
    if (target.id === '535857300552810526') return message.reply('❌ Cet utilisateur ne peut pas être banni.');
    if (!target.bannable) return message.reply('Je ne peux pas bannir cet utilisateur.');
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try {
      await target.ban({ reason: `${message.author.tag}: ${reason}`, deleteMessageSeconds: 604800 });
      await message.reply({ embeds: [embed('#FF4444').setTitle('Utilisateur banni').addFields(
        { name: 'Utilisateur', value: target.user.tag,    inline: true },
        { name: 'Par',         value: message.author.tag, inline: true },
        { name: 'Raison',      value: reason,             inline: false },
      )] });
      await logSanction(message.guild, [
        { name: 'Membre', value: target.user.tag,           inline: true },
        { name: 'Par',    value: `<@${message.author.id}>`, inline: true },
        { name: 'Raison', value: reason,                    inline: false },
      ], `Ban -- ${target.user.tag}`, '#FF0000');
    } catch (err) { await message.reply(`Erreur lors du ban : ${err.message}`); }
  },

  // ── FLUIDE ───────────────────────────────────────────────────
  '!fluide': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!fluide @user`');
    const motifs = ['comportement inexplicable detecte', 'neurones dysfonctionnels confirmes', 'coherence logique introuvable', 'ratio subi sans broncher', 'a defendu un cope en public', 'a demande une source', 'a mentionne le MK-677 volontairement', 'analyse biometrique : QI fluide detecte', 'a pris du fenugrec en pensant que ca servait a quelque chose', 'a confondu creatine et steroides pour la 3eme fois'];
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    await message.reply({ embeds: [embed('#9B59B6').setTitle('Systeme Fluide Active')
      .setDescription(`<@${target.id}> est officiellement passe sous **systeme fluide** pour les prochaines **24h**.\n\nConformement a la regle 3, les insultes et ratios a son encontre sont desormais **autorises et encourages**.`)
      .addFields(
        { name: 'Motif detecte', value: motif,                                  inline: false },
        { name: 'Statut',        value: 'FLUIDE -- Protection sociale retiree',  inline: true  },
        { name: 'Duree estimee', value: '24h (ou jusqu\'a guerison)',           inline: true  },
      ).setFooter({ text: `Decision prise par ${message.author.displayName} -- Systeme Fluide` })] });
  },

  // ── IQTEST ───────────────────────────────────────────────────
  '!iqtest': async (message) => {
    const target = message.mentions.members.first() || message.member;
    const base = isAdmin(message.author.id) ? 110 : 90;
    const iq   = Math.floor(base + (Math.random() * 80) - 40);
    let verdict, color;
    if      (iq >= 145) { verdict = 'Genie absolu. Probablement un mensonge.';                  color = '#7289DA'; }
    else if (iq >= 120) { verdict = 'Intelligent. Tu poses quand meme des questions idiotes.';   color = '#00B5D8'; }
    else if (iq >= 100) { verdict = 'Dans la moyenne. C\'est pas glorieux.';                    color = '#FAD961'; }
    else if (iq >= 80)  { verdict = 'En dessous de la moyenne. Ca explique beaucoup.';          color = '#FFA500'; }
    else if (iq >= 60)  { verdict = 'Cliniquement preoccupant. Consulte.';                      color = '#FF4444'; }
    else                { verdict = 'Roche. Tu es une roche.';                                  color = '#FF0000'; }
    await message.reply({ embeds: [embed(color).setTitle(`Resultat IQ -- ${target.displayName}`).addFields(
      { name: 'Score officiel', value: `**${iq} points**`,                               inline: true  },
      { name: 'Percentile',     value: `Top ${Math.max(1, 100 - Math.floor(iq / 2))}%`, inline: true  },
      { name: 'Verdict',        value: verdict,                                           inline: false },
    ).setFooter({ text: 'Certifie par l\'Institut International du Cerveau Fluide' })] });
  },

  // ── COPE DU JOUR ─────────────────────────────────────────────
  '!cope-du-jour': async (message) => {
    if (copesData.cope.length === 0) return message.reply('Aucun cope dans la liste. Utilise `!add-cope` pour en ajouter.');
    const random = copesData.cope[Math.floor(Math.random() * copesData.cope.length)];
    const refutations = ['Aucune etude peer-reviewed ne supporte cette affirmation.', 'Des scientifiques ont tente de reproduire ces resultats. Ils pleurent encore.', 'Efficacite prouvee sur 3 personnes dont 2 qui voulaient recuperer leur argent.', 'Le seul effet documente : appauvrissement du portefeuille.', 'Meta-analyse de 0 etudes conclut a l\'absence totale d\'effet.', 'Recommande par des influenceurs fitness. C\'est tout ce qu\'on dira.', 'La FDA, l\'EFSA et ton medecin generaliste ont ri en choeur.', 'Fonctionne tres bien sur des souris. Toi, tu n\'es pas une souris.', 'Approuve par des gens qui vendent aussi des colliers magnetiques.', 'L\'etude citee : un blog wordpress de 2011 sans sources.'];
    const refutation = refutations[Math.floor(Math.random() * refutations.length)];
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('Cope du jour').addFields(
      { name: 'Produit du jour',   value: `**${random}**`, inline: false },
      { name: 'Avis scientifique', value: refutation,      inline: false },
    ).setFooter({ text: 'Base sur des donnees solides. Tres solides. Betonnees.' })] });
  },

  // ── MOMMY ASMR ───────────────────────────────────────────────
  '!mommy-asmr': async (message) => {
    if (!CONFIG.MOMMY_ASMR_USER_IDS.includes(message.author.id)) return message.reply('Permission refusee.');
    try {
      await message.channel.send({ content: 'Mommy ASMR en approche...', files: [CONFIG.MOMMY_ASMR_FILE_URL] });
    } catch (err) { await message.reply(`Echec envoi ASMR : ${err.message}`); }
  },

  // ============================================================
  //  VÉRIFICATION MANUELLE — COMMANDES ADMIN
  // ============================================================

  /**
   * !verif-setup
   * Guide l'admin pour configurer le système de vérification
   */
  '!verif-setup': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');

    const parts = args.join(' ').split('|').map(s => s.trim());

    // Mode affichage si pas d'args
    if (parts.length < 4 || !parts[0]) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00C851')
          .setTitle('⚙️ Configuration Vérification — Assistant')
          .setDescription(
            'Pour configurer le système, utilise :\n' +
            '```\n!verif-setup @role-pending | @role-approuvé | #channel-verif | #channel-log-admin\n```\n\n' +
            '**Explications :**\n' +
            '• `@role-pending` — Rôle donné après réaction (accès limité)\n' +
            '• `@role-approuvé` — Rôle donné après approbation admin (accès complet)\n' +
            '• `#channel-verif` — Salon où le membre attend sa vérif\n' +
            '• `#channel-log-admin` — Salon privé admin où arrivent les demandes\n\n' +
            '**Config actuelle :**\n' +
            `• Rôle pending : ${verifConfig.pendingRoleId  ? `<@&${verifConfig.pendingRoleId}>`  : '`non défini`'}\n` +
            `• Rôle approuvé : ${verifConfig.approvedRoleId ? `<@&${verifConfig.approvedRoleId}>` : '`non défini`'}\n` +
            `• Channel vérif : ${verifConfig.verifChannelId ? `<#${verifConfig.verifChannelId}>` : '`non défini`'}\n` +
            `• Channel log : ${verifConfig.logChannelId    ? `<#${verifConfig.logChannelId}>`   : '`non défini`'}\n` +
            `• Statut : ${verifConfig.enabled ? '✅ **ACTIVÉ**' : '❌ **DÉSACTIVÉ**'}`
          )
          .setFooter({ text: 'Après configuration, utilise !verif-enable pour activer' })],
      });
    }

    // Extraction des roles et channels depuis les mentions
    const roles    = message.mentions.roles;
    const channels = message.mentions.channels;

    if (roles.size < 2) return message.reply('Tu dois mentionner **2 rôles** : `@role-pending` et `@role-approuvé`.');
    if (channels.size < 2) return message.reply('Tu dois mentionner **2 channels** : `#channel-verif` et `#channel-log-admin`.');

    const rolesArr    = [...roles.values()];
    const channelsArr = [...channels.values()];

    verifConfig.pendingRoleId  = rolesArr[0].id;
    verifConfig.approvedRoleId = rolesArr[1].id;
    verifConfig.verifChannelId = channelsArr[0].id;
    verifConfig.logChannelId   = channelsArr[1].id;
    saveVerifConfig();

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#00C851')
        .setTitle('✅ Vérification configurée')
        .addFields(
          { name: 'Rôle pending',   value: `<@&${verifConfig.pendingRoleId}>`,  inline: true },
          { name: 'Rôle approuvé',  value: `<@&${verifConfig.approvedRoleId}>`, inline: true },
          { name: '\u200b',         value: '\u200b',                             inline: true },
          { name: 'Channel vérif',  value: `<#${verifConfig.verifChannelId}>`,  inline: true },
          { name: 'Channel log',    value: `<#${verifConfig.logChannelId}>`,    inline: true },
          { name: '\u200b',         value: '\u200b',                             inline: true },
        )
        .setDescription(
          '⚠️ **Pense aussi à :**\n' +
          `1. Mettre à jour \`CONFIG.REACTION_ROLE.ROLE_ID\` avec l'ID du rôle pending : \`${verifConfig.pendingRoleId}\`\n` +
          '2. Utiliser `!verif-enable` pour activer le système\n' +
          '3. Configurer les permissions du channel vérif pour que seul le rôle pending puisse le voir'
        )
        .setFooter({ text: 'Système prêt · Utilise !verif-enable pour activer' })],
    });
  },

  '!verif-config': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const pendingCount = Object.keys(pendingVerifs).length;
    const blCount      = Object.keys(blacklistData).length;
    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(verifConfig.enabled ? '#00C851' : '#FF4444')
        .setTitle(`🔍 Config Vérification — ${verifConfig.enabled ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ'}`)
        .addFields(
          { name: 'Rôle pending',         value: verifConfig.pendingRoleId  ? `<@&${verifConfig.pendingRoleId}>`  : '`non défini`', inline: true },
          { name: 'Rôle approuvé',        value: verifConfig.approvedRoleId ? `<@&${verifConfig.approvedRoleId}>` : '`non défini`', inline: true },
          { name: '\u200b',               value: '\u200b', inline: true },
          { name: 'Channel vérif',        value: verifConfig.verifChannelId ? `<#${verifConfig.verifChannelId}>` : '`non défini`', inline: true },
          { name: 'Channel log admin',    value: verifConfig.logChannelId   ? `<#${verifConfig.logChannelId}>`   : '`non défini`', inline: true },
          { name: '\u200b',               value: '\u200b', inline: true },
          { name: '⏳ En attente',        value: `${pendingCount} membre(s)`, inline: true },
          { name: '🚫 Blacklistés',       value: `${blCount} entrée(s)`,      inline: true },
        )
        .setFooter({ text: '!verif-enable / !verif-disable · !verif-setup pour reconfigurer' })],
    });
  },

  '!verif-enable': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    if (!verifConfig.pendingRoleId || !verifConfig.approvedRoleId || !verifConfig.logChannelId) {
      return message.reply('❌ Configure d\'abord le système avec `!verif-setup` avant de l\'activer.');
    }
    verifConfig.enabled = true; saveVerifConfig();
    await message.reply('✅ Système de vérification **activé**. Les nouvelles réactions déclencheront le flux de vérification manuelle.');
  },

  '!verif-disable': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    verifConfig.enabled = false; saveVerifConfig();
    await message.reply('❌ Système de vérification **désactivé**. Le comportement par défaut (rôle direct) est restauré.');
  },

  // ── WHITELIST / BLACKLIST ─────────────────────────────────────
  '!whitelist': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!whitelist @user`');

    if (!verifConfig.approvedRoleId) return message.reply('Rôle approuvé non configuré. Utilise `!verif-setup`.');

    const approvedRole = message.guild.roles.cache.get(verifConfig.approvedRoleId);
    if (!approvedRole) return message.reply(`Rôle approuvé introuvable (ID: \`${verifConfig.approvedRoleId}\`).`);

    try {
      // Ajouter le rôle approuvé
      await target.roles.add(approvedRole, `Approbation manuelle par ${message.author.tag}`);

      // Retirer le rôle pending si présent
      if (verifConfig.pendingRoleId && target.roles.cache.has(verifConfig.pendingRoleId)) {
        const pendingRole = message.guild.roles.cache.get(verifConfig.pendingRoleId);
        if (pendingRole) await target.roles.remove(pendingRole, 'Vérification approuvée').catch(() => {});
      }

      // Désactiver les boutons du message de log
      await disableVerifButtons(message.guild, target.id, 'approved');
      delete pendingVerifs[target.id]; savePendingVerifs();

      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00C851')
          .setTitle('✅ Membre approuvé')
          .setDescription(`<@${target.id}> a été approuvé manuellement et a maintenant accès au serveur.`)
          .addFields(
            { name: 'Rôle attribué', value: `<@&${verifConfig.approvedRoleId}>`, inline: true },
            { name: 'Par',           value: `<@${message.author.id}>`,           inline: true },
          )],
      });

      // Notifier le membre dans le channel vérif si configuré
      if (verifConfig.verifChannelId) {
        const verifCh = message.guild.channels.cache.get(verifConfig.verifChannelId);
        if (verifCh) {
          await verifCh.send({
            content: `<@${target.id}>`,
            embeds: [new EmbedBuilder()
              .setColor('#00C851')
              .setTitle('✅ Vérification approuvée !')
              .setDescription('Tu as été vérifié et tu as maintenant accès au serveur. Bienvenue ! 🎉')],
          }).catch(() => {});
        }
      }
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  '!blacklist': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!blacklist @user [raison]`');
    if (isAdmin(target.id)) return message.reply('Impossible de blacklister un admin.');

    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

    blacklistData[target.id] = {
      tag:    target.user.tag,
      reason,
      by:     message.author.id,
      at:     new Date().toISOString(),
    };
    saveBlacklist();

    // Désactiver les boutons de log si en attente
    await disableVerifButtons(message.guild, target.id, 'blacklisted');
    delete pendingVerifs[target.id]; savePendingVerifs();

    try {
      await target.kick(`Blacklist par ${message.author.tag} : ${reason}`);
    } catch (err) {
      console.warn('[BLACKLIST] Impossible de kick :', err.message);
    }

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚫 Membre blacklisté & kické')
        .addFields(
          { name: 'Membre', value: `${target.user.tag} (${target.id})`, inline: false },
          { name: 'Raison', value: reason,                               inline: false },
          { name: 'Par',    value: `<@${message.author.id}>`,           inline: true },
        )
        .setFooter({ text: 'Il sera bloqué automatiquement s\'il tente de rejoindre à nouveau' })],
    });
    await logSanction(message.guild, [
      { name: 'Membre', value: target.user.tag,           inline: true },
      { name: 'Par',    value: `<@${message.author.id}>`, inline: true },
      { name: 'Raison', value: reason,                    inline: false },
    ], `Blacklist — ${target.user.tag}`, '#FF0000');
  },

  '!unblacklist': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.users.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!unblacklist @user`');

    if (!blacklistData[target.id]) return message.reply(`<@${target.id}> n'est pas dans la blacklist.`);

    const entry = blacklistData[target.id];
    delete blacklistData[target.id]; saveBlacklist();

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#00C851')
        .setTitle('✅ Blacklist levée')
        .addFields(
          { name: 'Membre',            value: entry.tag || target.tag, inline: true },
          { name: 'Par',               value: `<@${message.author.id}>`, inline: true },
          { name: 'Raison initiale',   value: entry.reason,              inline: false },
          { name: 'Blacklisté le',     value: new Date(entry.at).toLocaleString('fr-FR'), inline: false },
        )
        .setFooter({ text: 'Il pourra rejoindre à nouveau et sera soumis à la vérification normale' })],
    });
  },

  '!blacklist-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const entries = Object.entries(blacklistData);
    if (entries.length === 0) return message.reply('La blacklist est vide. ✅');

    const fields = entries.slice(0, 25).map(([userId, data]) => ({
      name: `${data.tag || userId} · \`${userId}\``,
      value: `Raison : ${data.reason}\nPar <@${data.by}> le ${new Date(data.at).toLocaleDateString('fr-FR')}`,
      inline: false,
    }));

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🚫 Blacklist — ${entries.length} entrée(s)`)
        .addFields(fields)
        .setFooter({ text: entries.length > 25 ? `Affiche 25/${entries.length} entrées` : `${entries.length} entrée(s) au total` })],
    });
  },

  '!pending-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const entries = Object.entries(pendingVerifs);
    if (entries.length === 0) return message.reply('Aucune vérification en attente. ✅');

    const fields = entries.slice(0, 25).map(([userId, data]) => ({
      name: `${data.tag} · \`${userId}\``,
      value: `Demande reçue le ${new Date(data.requestedAt).toLocaleString('fr-FR')}\n[Voir le message](https://discord.com/channels/${message.guild.id}/${data.logChannelId}/${data.logMessageId})`,
      inline: false,
    }));

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`⏳ Vérifications en attente — ${entries.length}`)
        .addFields(fields)
        .setFooter({ text: 'Utilise les boutons dans le channel log pour traiter chaque demande' })],
    });
  },

  // ============================================================
  //  RATING GYMGIRL — SYSTÈME ELO
  // ============================================================

  '!rate': async (message) => {
    if (!hasRatingRole(message.member)) {
      return message.reply('Tu n\'as pas le rôle requis pour utiliser le rating. Demande à un admin avec `!give-rating @toi`.');
    }

    const db = await getGymgirls();
    const girls = db.girls || [];

    if (girls.length < 2) {
      return message.reply('Pas assez de gymgirls dans la base (minimum 2). Un admin peut en ajouter avec `!rate-add <nom> | <url>`.');
    }

    if (db.activeVotes && db.activeVotes[message.channel.id]) {
      return message.reply('Un vote est déjà en cours dans ce salon. Attends la fin ou que le timer expire (5 min).');
    }

    const shuffled = [...girls].sort(() => Math.random() - 0.5);
    const girlA    = shuffled[0];
    const girlB    = shuffled[1];
    const voteId   = Date.now().toString(36);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rate_${voteId}_A`)
        .setLabel('⬅️  Elle')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rate_${voteId}_skip`)
        .setLabel('⏭️  Skip')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rate_${voteId}_B`)
        .setLabel('Elle  ➡️')
        .setStyle(ButtonStyle.Danger),
    );

    const headerEmbed = new EmbedBuilder()
      .setColor('#FF6B9D')
      .setTitle('⚡ Qui a le meilleur physique ?')
      .setDescription(
        `**${girlA.name}** \`ELO ${girlA.elo}\`  vs  **${girlB.name}** \`ELO ${girlB.elo}\`\n\n` +
        `Clique sur un bouton pour voter — le résultat met à jour le classement ELO en temps réel.\n` +
        `Plusieurs membres peuvent voter sur le même duel.`
      )
      .setFooter({ text: `Vote lancé par ${message.author.displayName} · Expire dans 5 min` })
      .setTimestamp();

    await message.channel.send({ embeds: [headerEmbed] });

    await message.channel.send({ content: `⬅️  **${girlA.name}**`, files: [girlA.imageUrl] })
      .catch(() => message.channel.send({ content: `⬅️  **${girlA.name}** — ${girlA.imageUrl}` }));

    await message.channel.send({ content: `➡️  **${girlB.name}**`, files: [girlB.imageUrl] })
      .catch(() => message.channel.send({ content: `➡️  **${girlB.name}** — ${girlB.imageUrl}` }));

    const voteMsg = await message.channel.send({ components: [row] });

    if (!db.activeVotes) db.activeVotes = {};
    db.activeVotes[message.channel.id] = {
      voteId,
      channelId:   message.channel.id,
      messageId:   voteMsg.id,
      girlAId:     girlA.id,
      girlBId:     girlB.id,
      votedUsers:  [],
      createdAt:   Date.now(),
    };
    await saveGymgirls(db);

    setTimeout(async () => {
      try {
        const fresh = await getGymgirls();
        if (!fresh.activeVotes?.[message.channel.id] || fresh.activeVotes[message.channel.id].voteId !== voteId) return;
        delete fresh.activeVotes[message.channel.id];
        await saveGymgirls(fresh);

        const msg = await message.channel.messages.fetch(voteMsg.id).catch(() => null);
        if (msg) {
          const expiredRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rate_expired_A').setLabel('⬅️ Elle').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rate_expired_skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rate_expired_B').setLabel('Elle ➡️').setStyle(ButtonStyle.Secondary).setDisabled(true),
          );
          await msg.edit({ components: [expiredRow] }).catch(() => {});
        }

        await message.channel.send({
          embeds: [new EmbedBuilder().setColor('#888888').setTitle('⏱️ Vote expiré')
            .setDescription(`Le duel **${girlA.name}** vs **${girlB.name}** a expiré sans vainqueur.`)],
        }).catch(() => {});
      } catch (err) { console.error('[RATE] Erreur expiration :', err.message); }
    }, 5 * 60 * 1000);
  },

  '!rate-top': async (message) => {
    if (!hasRatingRole(message.member)) return message.reply('Tu n\'as pas le rôle requis.');
    const db     = await getGymgirls();
    const girls  = db.girls || [];
    if (girls.length === 0) return message.reply('Aucune gymgirl dans la base de données.');

    const sorted  = [...girls].sort((a, b) => b.elo - a.elo);
    const medals  = ['🥇', '🥈', '🥉'];
    const fields  = sorted.slice(0, 10).map((g, i) => {
      const total   = g.wins + g.losses;
      const winrate = total > 0 ? Math.round(g.wins / total * 100) : 0;
      return {
        name:   `${medals[i] || `#${i + 1}`}  ${g.name}`,
        value:  `ELO **${g.elo}** · ${g.wins}V / ${g.losses}D · Win rate ${winrate}%`,
        inline: false,
      };
    });

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Classement Gymgirl — Top 10')
        .addFields(fields)
        .setFooter({ text: `${girls.length} athlète(s) dans la base · Système ELO (K=32)` })
        .setTimestamp()],
    });
  },

  '!rate-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const db    = await getGymgirls();
    const girls = db.girls || [];
    if (girls.length === 0) return message.reply('Aucune gymgirl dans la base.');
    const sorted = [...girls].sort((a, b) => b.elo - a.elo);
    const list   = sorted.map((g, i) => `\`${String(i + 1).padStart(2, '0')}\` **${g.name}** · ELO ${g.elo} · ${g.wins}V/${g.losses}D · ID \`${g.id}\``).join('\n');
    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#7289DA')
        .setTitle(`📋 Liste complète — ${girls.length} gymgirl(s)`)
        .setDescription(list.slice(0, 4096))
        .setFooter({ text: 'Base de données : JSONBin.io · !rate-add / !rate-remove pour gérer' })],
    });
  },

  '!rate-add': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!rate-add <nom> | <url_image>`');
    const [name, imageUrl] = parts;
    if (!imageUrl.startsWith('http')) return message.reply('L\'URL doit commencer par `http`.');

    const db    = await getGymgirls();
    const girls = db.girls || [];

    if (girls.find(g => g.name.toLowerCase() === name.toLowerCase())) {
      return message.reply(`**${name}** est déjà dans la base.`);
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    girls.push({ id, name, imageUrl, elo: 1000, wins: 0, losses: 0 });
    db.girls = girls;
    await saveGymgirls(db);

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#00FF66')
        .setTitle('Gymgirl ajoutée ✅')
        .addFields(
          { name: 'Nom',      value: name,          inline: true },
          { name: 'ELO init', value: '1000',         inline: true },
          { name: 'ID',       value: `\`${id}\``,    inline: true },
        )
        .setThumbnail(imageUrl)
        .setFooter({ text: 'Sauvegardé sur JSONBin.io' })],
    });
  },

  '!rate-remove': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('Format : `!rate-remove <nom>`');

    const db    = await getGymgirls();
    const girls = db.girls || [];
    const idx   = girls.findIndex(g => g.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) return message.reply(`**${name}** introuvable dans la base.`);

    const [removed] = girls.splice(idx, 1);
    db.girls = girls;
    await saveGymgirls(db);
    await message.reply(`**${removed.name}** retirée. ELO final : **${removed.elo}** (${removed.wins}V / ${removed.losses}D).`);
  },

  '!rate-reset': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('Format : `!rate-reset <nom>`');

    const db    = await getGymgirls();
    const girl  = (db.girls || []).find(g => g.name.toLowerCase() === name.toLowerCase());
    if (!girl) return message.reply(`**${name}** introuvable.`);

    girl.elo = 1000; girl.wins = 0; girl.losses = 0;
    await saveGymgirls(db);
    await message.reply(`ELO de **${girl.name}** réinitialisé à 1000.`);
  },

  // ── GIVE-RATING ──────────────────────────────────────────────
  '!give-rating': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!give-rating @user`');

    const role = message.guild.roles.cache.get(CONFIG.RATING_ROLE_ID);
    if (!role) return message.reply(`Rôle introuvable (ID : \`${CONFIG.RATING_ROLE_ID}\`). Vérifie la config.`);

    if (target.roles.cache.has(CONFIG.RATING_ROLE_ID)) {
      await target.roles.remove(role, `Rating role retiré par ${message.author.tag}`);
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FF4444')
          .setTitle('Rôle Rating retiré')
          .setDescription(`<@${target.id}> n'a plus accès au système de rating.`)
          .addFields({ name: 'Par', value: `<@${message.author.id}>`, inline: true })],
      });
    }

    await target.roles.add(role, `Rating role donné par ${message.author.tag}`);
    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#00FF66')
        .setTitle('Rôle Rating attribué ✅')
        .setDescription(`<@${target.id}> a désormais accès au système de rating gymgirl.`)
        .addFields(
          { name: 'Rôle',  value: `<@&${CONFIG.RATING_ROLE_ID}>`,  inline: true },
          { name: 'Par',   value: `<@${message.author.id}>`,        inline: true },
        )
        .setFooter({ text: 'Il peut maintenant utiliser !rate et !rate-top' })],
    });
  },

  // ── LIVE (vérification manuelle TikTok) ──────────────────────
  '!live': async (message) => {
    const statusMsg = await message.reply({ embeds: [embed('#FF0050').setTitle('Vérification TikTok en cours...').setDescription(`Interrogation de TikTok pour **@${CONFIG.TIKTOK_USERNAME}**...`)] });
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Mode': 'navigate',
      };
      const response = await axios.get(`https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, { headers, timeout: 15000, maxRedirects: 5 });
      const html = response.data;
      const patterns = [
        /"statusStr"\s*:\s*"LIVE_STATUS_STREAMING"/.test(html),
        /"isLiveStreaming"\s*:\s*true/.test(html),
        /"liveRoomInfo"/.test(html) && /"status"\s*:\s*2/.test(html),
        /roomid[^"]*"[^"]{5,}/.test(html) && !/redirectUrl/.test(html),
        /"liveUrl"/.test(html) && !/"liveUrl"\s*:\s*""/.test(html),
      ];
      const positiveSignals = patterns.filter(Boolean).length;
      const isLive = positiveSignals >= 2;
      const color = isLive ? '#FF0050' : '#95A5A6';
      const statusText = isLive ? '🔴 EN LIVE ACTUELLEMENT' : '⚫ Pas en live';
      const e = embed(color)
        .setTitle(`TikTok Live — @${CONFIG.TIKTOK_USERNAME}`)
        .setDescription(`**Statut :** ${statusText}`)
        .addFields(
          { name: 'Signaux détectés', value: `${positiveSignals}/5`, inline: true },
          { name: 'Lien', value: `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, inline: false },
        )
        .setThumbnail(`https://unavatar.io/tiktok/${CONFIG.TIKTOK_USERNAME}`)
        .setFooter({ text: `Vérifié manuellement par ${message.author.tag}` });
      await statusMsg.edit({ embeds: [e] });
    } catch (err) {
      await statusMsg.edit({ embeds: [embed('#FF4444').setTitle('Erreur de vérification').setDescription(`Impossible de contacter TikTok : \`${err.message}\``)] });
    }
  },

  // ── STATS @user ───────────────────────────────────────────────
  '!stats': async (message) => {
    const target = message.mentions.members.first() || message.member;
    const userId = target.id;
    const warns = warnsData[userId]?.length || 0;
    const isJailed = !!jailsData[userId];
    const isNpc = !!npcList[userId];
    const isTf = !!tfList[userId];
    const isBlacklisted = !!blacklistData[userId];
    const ageDays = Math.floor((Date.now() - (Number(BigInt(userId) >> 22n) + 1420070400000)) / 86400000);
    const joinedTs = target.joinedAt ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:D>` : 'Inconnu';
    const createdTs = `<t:${Math.floor((Number(BigInt(userId) >> 22n) + 1420070400000) / 1000)}:D>`;
    const roles = target.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(', ') || '*Aucun*';

    const statusFlags = [];
    if (isJailed)      statusFlags.push('🔒 En jail');
    if (isNpc)         statusFlags.push('🤖 NPC actif');
    if (isTf)          statusFlags.push('📛 TF actif');
    if (isBlacklisted) statusFlags.push('🚫 Blacklisté');
    if (isAdmin(userId)) statusFlags.push('⚡ Admin');
    if (statusFlags.length === 0) statusFlags.push('✅ Normal');

    const color = isJailed ? '#FF4444' : warns >= 2 ? '#FFA500' : '#5865F2';
    await message.reply({ embeds: [embed(color)
      .setTitle(`Profil — ${target.displayName}`)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👤 Identité',       value: `${target.user.tag}\nID : \`${userId}\``,             inline: true  },
        { name: '📅 Arrivée',        value: `Serveur : ${joinedTs}\nCompte : ${createdTs}`,        inline: true  },
        { name: '⚠️ Warns',          value: `**${warns}/3**`,                                      inline: true  },
        { name: '🚨 Statut actuel',  value: statusFlags.join('\n'),                                inline: true  },
        { name: `🎭 Rôles (${target.roles.cache.size - 1})`, value: roles.slice(0, 1024),          inline: false },
      )
      .setFooter({ text: `Compte vieux de ${ageDays} jours` })
    ] });
  },

  // ── SONDAGE ───────────────────────────────────────────────────
  '!sondage': async (message, args) => {
    const parts = args.join(' ').split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) return message.reply('Format : `!sondage <question> | <option1> | <option2> | [option3] | [option4]`\nMinimum 2 options, maximum 4.');
    const [question, ...options] = parts;
    if (options.length > 4) return message.reply('Maximum 4 options.');

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const votes = options.map(() => 0);
    const voters = {};

    const buildEmbed = (voteData) => {
      const total = voteData.reduce((a, b) => a + b, 0);
      const fields = options.map((opt, i) => {
        const pct = total > 0 ? Math.round(voteData[i] / total * 100) : 0;
        const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
        return { name: `${emojis[i]} ${opt}`, value: `${bar} **${pct}%** (${voteData[i]} vote${voteData[i] !== 1 ? 's' : ''})`, inline: false };
      });
      return embed('#5865F2')
        .setTitle(`📊 ${question}`)
        .addFields(fields)
        .setFooter({ text: `${total} vote${total !== 1 ? 's' : ''} · Sondage lancé par ${message.author.tag}` });
    };

    const row = new ActionRowBuilder().addComponents(
      options.map((opt, i) =>
        new ButtonBuilder()
          .setCustomId(`sondage_${i}`)
          .setLabel(`${emojis[i]} ${opt.slice(0, 50)}`)
          .setStyle(ButtonStyle.Primary)
      )
    );

    try { await message.delete(); } catch {}
    const sondageMsg = await message.channel.send({ embeds: [buildEmbed(votes)], components: [row] });
    activeSondages[sondageMsg.id] = { question, options, votes, voters, buildEmbed, authorTag: message.author.tag };
  },

  // ── UNJAIL @user ──────────────────────────────────────────────
  '!unjail': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!unjail @user`');

    const jailData = jailsData[target.id];
    if (!jailData) return message.reply(`<@${target.id}> n'est pas en jail actuellement.`);

    try {
      const savedRoleIds = jailData.savedRoleIds || [];
      await unjailMember(target, savedRoleIds, `Liberation manuelle par ${message.author.tag}`);
      delete jailsData[target.id]; saveJails();

      const prisonChannel = message.guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
      if (prisonChannel) {
        await prisonChannel.send({ embeds: [embed('#00FF66').setTitle('Libéré !').setDescription(`<@${target.id}> a été libéré manuellement par <@${message.author.id}>. Ses rôles ont été restaurés.`)] });
      }
      await message.reply({ embeds: [embed('#00FF66')
        .setTitle('Jail levé')
        .setDescription(`<@${target.id}> a été libéré avant la fin de sa peine.`)
        .addFields(
          { name: 'Libéré par',    value: `<@${message.author.id}>`,   inline: true },
          { name: 'Rôles rendus',  value: `${savedRoleIds.length}`,    inline: true },
        )
      ] });
      await logSanction(message.guild, [
        { name: 'Membre',    value: `<@${target.id}>`,          inline: true },
        { name: 'Par',       value: `<@${message.author.id}>`,  inline: true },
        { name: 'Motif',     value: 'Liberation manuelle',      inline: false },
      ], `Unjail — ${target.user.tag}`, '#00FF66');
    } catch (err) {
      await message.reply(`Erreur lors de la libération : ${err.message}`);
    }
  },

  // ── SET-COPE-BULK ─────────────────────────────────────────────
  '!set-cope-bulk': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    // Format : !set-cope-bulk cope | item1, item2, item3
    //      ou  !set-cope-bulk interesting | item1, item2
    const joined = args.join(' ');
    const pipeIdx = joined.indexOf('|');
    if (pipeIdx === -1) return message.reply('Format : `!set-cope-bulk <cope|interesting> | item1, item2, item3`');

    const type  = joined.slice(0, pipeIdx).trim().toLowerCase();
    const items = joined.slice(pipeIdx + 1).split(',').map(s => s.trim()).filter(Boolean);

    if (!['cope', 'interesting'].includes(type)) return message.reply('Type invalide. Utilise `cope` ou `interesting`.');
    if (items.length === 0) return message.reply('Aucun élément fourni après le `|`.');

    const list = copesData[type];
    let added = 0; const skipped = [];
    for (const item of items) {
      if (list.includes(item)) { skipped.push(item); continue; }
      list.push(item); added++;
    }
    saveJSON(FILES.copes, copesData);

    await message.reply({ embeds: [embed('#00FF66')
      .setTitle(`Import en masse — ${type === 'cope' ? 'COPE' : 'Intéressants'}`)
      .addFields(
        { name: '✅ Ajoutés',  value: `${added} élément(s)`,                                      inline: true },
        { name: '⏭️ Ignorés', value: `${skipped.length} (déjà présents)`,                         inline: true },
        { name: 'Total liste', value: `${list.length} élément(s)`,                                 inline: true },
        { name: 'Éléments ajoutés', value: items.filter(i => !skipped.includes(i)).map(i => `• ${i}`).join('\n').slice(0, 1024) || '*Aucun*', inline: false },
      )
    ] });
  },

  // ── MUTE @user <durée en minutes> ────────────────────────────
  '!mute': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Format : `!mute @user <durée en minutes> [raison]`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas muter un admin.');

    const durationMin = parseInt(args[1]);
    if (isNaN(durationMin) || durationMin < 1 || durationMin > 40320) {
      return message.reply('Durée invalide. Indique un nombre de minutes entre 1 et 40320 (28 jours max).');
    }
    const reason = args.slice(2).join(' ') || 'Aucune raison fournie';
    const durationMs = durationMin * 60 * 1000;

    try {
      await target.timeout(durationMs, `${message.author.tag} : ${reason}`);
      await message.reply({ embeds: [embed('#FFA500')
        .setTitle('Membre muté')
        .setDescription(`<@${target.id}> a été mis en timeout.`)
        .addFields(
          { name: 'Durée',  value: `${durationMin} minute${durationMin > 1 ? 's' : ''}`, inline: true },
          { name: 'Par',    value: `<@${message.author.id}>`,                             inline: true },
          { name: 'Raison', value: reason,                                                inline: false },
        )
        .setFooter({ text: `Levée automatique dans ${durationMin} min` })
      ] });
      await logSanction(message.guild, [
        { name: 'Membre', value: `<@${target.id}>`,          inline: true },
        { name: 'Par',    value: `<@${message.author.id}>`,  inline: true },
        { name: 'Durée',  value: `${durationMin} min`,        inline: true },
        { name: 'Raison', value: reason,                      inline: false },
      ], `Mute — ${target.user.tag}`, '#FFA500');
    } catch (err) {
      await message.reply(`Impossible de muter : ${err.message}`);
    }
  },

  // ── LIKE-ENABLE / LIKE-DISABLE ────────────────────────────────
  '!like-enable': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    likeEnabled = true;
    await message.reply({ embeds: [embed('#FFD700')
      .setTitle('Like auto — Activé ✅')
      .setDescription(`Le bot va maintenant liker **automatiquement** tous les messages de <@${LIKE_TARGET_USER_ID}>.`)
      .setFooter({ text: `Activé par ${message.author.tag} · !like-disable pour arrêter` })
    ] });
  },

  '!like-disable': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    likeEnabled = false;
    await message.reply({ embeds: [embed('#95A5A6')
      .setTitle('Like auto — Désactivé ⛔')
      .setDescription(`Le bot ne like plus les messages de <@${LIKE_TARGET_USER_ID}>.`)
      .setFooter({ text: `Désactivé par ${message.author.tag}` })
    ] });
  },

  // ── CLEARROLE ────────────────────────────────────────────────
  '!clearrole': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusée.');
    const TARGET_ROLE_ID = '1487674672865611806';
    const guild = message.guild;
    const role = guild.roles.cache.get(TARGET_ROLE_ID);
    if (!role) return message.reply(`Rôle introuvable (ID : \`${TARGET_ROLE_ID}\`).`);
    const statusMsg = await message.reply(`🔄 Récupération des membres avec le rôle **${role.name}**...`);
    try {
      await guild.members.fetch();
      const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(TARGET_ROLE_ID));
      if (membersWithRole.size === 0) {
        return statusMsg.edit(`✅ Aucun membre ne possède le rôle **${role.name}**.`);
      }
      await statusMsg.edit(`🔄 Suppression du rôle **${role.name}** sur **${membersWithRole.size}** membre(s)...`);
      let success = 0;
      let failed  = 0;
      for (const [, member] of membersWithRole) {
        try {
          await member.roles.remove(role, `!clearrole exécuté par ${message.author.tag}`);
          success++;
        } catch {
          failed++;
        }
      }
      await statusMsg.edit({
        embeds: [new EmbedBuilder()
          .setColor(failed > 0 ? '#FFA500' : '#00FF66')
          .setTitle('✅ Clearrole terminé')
          .addFields(
            { name: 'Rôle ciblé',   value: `<@&${TARGET_ROLE_ID}>`,        inline: true },
            { name: '✅ Succès',     value: `${success} membre(s)`,          inline: true },
            { name: '❌ Échecs',     value: `${failed} membre(s)`,           inline: true },
            { name: 'Exécuté par',  value: `<@${message.author.id}>`,       inline: true },
          )
          .setFooter({ text: 'Le rôle a été retiré de tous les membres accessibles' })
          .setTimestamp()],
      });
      await logSanction(guild, [
        { name: 'Rôle',         value: `<@&${TARGET_ROLE_ID}>`,       inline: true },
        { name: 'Par',          value: `<@${message.author.id}>`,     inline: true },
        { name: 'Retirés',      value: `${success}`,                  inline: true },
        { name: 'Échecs',       value: `${failed}`,                   inline: true },
      ], 'Clearrole', '#FFA500');
    } catch (err) {
      await statusMsg.edit(`❌ Erreur : ${err.message}`);
    }
  },
};

// ============================================================
//  TOURNOI — LOGIQUE D'AVANCEMENT
// ============================================================

async function advanceTournament(tournamentId, channel) {
  const t = tournamentsData[tournamentId];
  if (!t || t.status !== 'active') return;
  const pairs = t.currentPairs;

  while (t.currentMatchIndex < pairs.length) {
    const [p1, p2] = pairs[t.currentMatchIndex];
    if (p2 === null) {
      t.roundWinners.push(p1);
      t.history.push({ round: t.currentRound, match: t.currentMatchIndex + 1, winner: p1, loser: null, bye: true });
      t.currentMatchIndex++; saveTournaments(); continue;
    }
    const voteMsgId = await sendVersus(channel, tournamentId, t.currentMatchIndex, p1, p2);
    t.currentVoteMessageId = voteMsgId; saveTournaments(); return;
  }

  const winners = t.roundWinners;

  if (winners.length === 1) {
    t.status = 'finished'; t.winner = winners[0]; saveTournaments();
    await channel.send({ content: '@everyone', embeds: [embed('#FFD700').setTitle('VICTOIRE FINALE !')
      .setDescription(`**${winners[0].username}** remporte le tournoi physique !\n\nFelicitations a <@${winners[0].userId}> !`)
      .addFields(
        { name: 'Gagnant',      value: `<@${winners[0].userId}>`, inline: true },
        { name: 'Participants', value: `${t.participants.length}`, inline: true },
        { name: 'Rounds',       value: `${t.currentRound}`,       inline: true },
      ).setFooter({ text: `Tournoi #${tournamentId} -- Termine` })] });
    return;
  }

  t.currentRound++;
  t.allRoundWinners.push(...t.roundWinners);
  t.currentPairs      = buildRound(winners);
  t.currentMatchIndex = 0;
  t.roundWinners      = [];
  saveTournaments();

  await channel.send({ embeds: [embed('#FFD700').setTitle(`Round ${t.currentRound} -- Debut !`)
    .setDescription(`**${winners.length} joueurs** s'affrontent pour le round ${t.currentRound} !`)
    .addFields({ name: 'Qualifies', value: winners.map(w => `<@${w.userId}>`).join(', ').slice(0, 1024), inline: false })] });
  await advanceTournament(tournamentId, channel);
}

// ============================================================
//  HANDLER — Interactions (boutons)
// ============================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;

  // ── Boutons de SONDAGE ─────────────────────────────────────
  if (customId.startsWith('sondage_')) {
    const optionIndex = parseInt(customId.split('_')[1]);
    const sondage = activeSondages[interaction.message.id];

    if (!sondage) {
      return interaction.reply({ content: 'Ce sondage n\'est plus actif ou a expiré.', ephemeral: true });
    }

    const userId = interaction.user.id;
    const previousVote = sondage.voters[userId];

    if (previousVote !== undefined) {
      // Changer de vote
      sondage.votes[previousVote]--;
    }
    sondage.votes[optionIndex]++;
    sondage.voters[userId] = optionIndex;

    const newEmbed = sondage.buildEmbed(sondage.votes);
    await interaction.update({ embeds: [newEmbed] });
    return;
  }

  // ── Boutons de VÉRIFICATION ────────────────────────────────
  if (customId.startsWith('verif_')) {
    // Seuls les admins peuvent interagir
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ content: '❌ Seuls les admins peuvent traiter les vérifications.', ephemeral: true });
    }

    const parts  = customId.split('_');
    const action = parts[1]; // approve | refuse | blacklist | done
    const userId = parts[2];

    // Bouton "Traité" (déjà désactivé)
    if (action === 'done') {
      return interaction.reply({ content: 'Cette demande a déjà été traitée.', ephemeral: true });
    }

    // Récupérer le membre
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
      // Membre parti — nettoyer quand même
      delete pendingVerifs[userId]; savePendingVerifs();
      await disableVerifButtons(interaction.guild, userId, 'refused');
      return interaction.reply({ content: '❌ Le membre a quitté le serveur. Demande nettoyée.', ephemeral: true });
    }

    // ── APPROUVER ──
    if (action === 'approve') {
      if (!verifConfig.approvedRoleId) {
        return interaction.reply({ content: '❌ Rôle approuvé non configuré.', ephemeral: true });
      }
      const approvedRole = interaction.guild.roles.cache.get(verifConfig.approvedRoleId);
      if (!approvedRole) {
        return interaction.reply({ content: `❌ Rôle approuvé introuvable (ID: ${verifConfig.approvedRoleId}).`, ephemeral: true });
      }

      try {
        await member.roles.add(approvedRole, `Approuvé par ${interaction.user.tag}`);

        // Retirer le rôle pending
        if (verifConfig.pendingRoleId && member.roles.cache.has(verifConfig.pendingRoleId)) {
          const pendingRole = interaction.guild.roles.cache.get(verifConfig.pendingRoleId);
          if (pendingRole) await member.roles.remove(pendingRole).catch(() => {});
        }

        await disableVerifButtons(interaction.guild, userId, 'approved');
        delete pendingVerifs[userId]; savePendingVerifs();

        // Notifier le membre
        if (verifConfig.verifChannelId) {
          const verifCh = interaction.guild.channels.cache.get(verifConfig.verifChannelId);
          if (verifCh) {
            await verifCh.send({
              content: `<@${userId}>`,
              embeds: [new EmbedBuilder()
                .setColor('#00C851')
                .setTitle('✅ Vérification approuvée !')
                .setDescription('Tu as été vérifié et tu as maintenant accès complet au serveur. Bienvenue ! 🎉')],
            }).catch(() => {});
          }
        }

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#00C851')
            .setTitle('✅ Approuvé')
            .setDescription(`<@${userId}> a été approuvé par <@${interaction.user.id}>.`)
            .addFields({ name: 'Rôle attribué', value: `<@&${verifConfig.approvedRoleId}>`, inline: true })],
          ephemeral: true,
        });

        // Mise à jour de l'embed original pour indiquer le statut
        await interaction.message.edit({
          embeds: [interaction.message.embeds[0].toJSON()
            ? new EmbedBuilder(interaction.message.embeds[0].toJSON())
                .setColor('#00C851')
                .setTitle(`✅ APPROUVÉ — ${interaction.message.embeds[0].title?.replace(/^[^\s]+\s/, '') || 'Demande de vérification'}`)
                .setFooter({ text: `Approuvé par ${interaction.user.tag} · ${new Date().toLocaleString('fr-FR')}` })
            : interaction.message.embeds[0]],
        }).catch(() => {});

      } catch (err) {
        return interaction.reply({ content: `Erreur : ${err.message}`, ephemeral: true });
      }
      return;
    }

    // ── REFUSER (kick) ──
    if (action === 'refuse') {
      try {
        // Notifier avant kick
        if (verifConfig.verifChannelId) {
          const verifCh = interaction.guild.channels.cache.get(verifConfig.verifChannelId);
          if (verifCh) {
            await verifCh.send({
              content: `<@${userId}>`,
              embeds: [new EmbedBuilder()
                .setColor('#FF4444')
                .setTitle('❌ Vérification refusée')
                .setDescription('Ta demande d\'accès a été refusée par le staff. Tu vas être retiré du serveur.')],
            }).catch(() => {});
          }
        }

        await new Promise(r => setTimeout(r, 2000)); // laisser le temps de lire
        await member.kick(`Refus de vérification par ${interaction.user.tag}`).catch(() => {});

        await disableVerifButtons(interaction.guild, userId, 'refused');
        delete pendingVerifs[userId]; savePendingVerifs();

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#FF4444')
            .setTitle('❌ Refusé & kické')
            .setDescription(`<@${userId}> a été refusé et kické par <@${interaction.user.id}>.`)],
          ephemeral: true,
        });

        // Mise à jour embed
        await interaction.message.edit({
          embeds: [interaction.message.embeds[0].toJSON()
            ? new EmbedBuilder(interaction.message.embeds[0].toJSON())
                .setColor('#FF4444')
                .setTitle(`❌ REFUSÉ — ${interaction.message.embeds[0].title?.replace(/^[^\s]+\s/, '') || 'Demande de vérification'}`)
                .setFooter({ text: `Refusé par ${interaction.user.tag} · ${new Date().toLocaleString('fr-FR')}` })
            : interaction.message.embeds[0]],
        }).catch(() => {});

      } catch (err) {
        return interaction.reply({ content: `Erreur : ${err.message}`, ephemeral: true });
      }
      return;
    }

    // ── BLACKLIST + KICK ──
    if (action === 'blacklist') {
      try {
        blacklistData[userId] = {
          tag:    member.user.tag,
          reason: `Blacklist via vérification par ${interaction.user.tag}`,
          by:     interaction.user.id,
          at:     new Date().toISOString(),
        };
        saveBlacklist();

        await member.kick(`Blacklist lors vérification par ${interaction.user.tag}`).catch(() => {});

        await disableVerifButtons(interaction.guild, userId, 'blacklisted');
        delete pendingVerifs[userId]; savePendingVerifs();

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🚫 Blacklisté & kické')
            .setDescription(`<@${userId}> a été blacklisté et kické par <@${interaction.user.id}>.\nIl sera automatiquement bloqué s'il tente de rejoindre.`)],
          ephemeral: true,
        });

        // Mise à jour embed
        await interaction.message.edit({
          embeds: [interaction.message.embeds[0].toJSON()
            ? new EmbedBuilder(interaction.message.embeds[0].toJSON())
                .setColor('#8B0000')
                .setTitle(`🚫 BLACKLISTÉ — ${interaction.message.embeds[0].title?.replace(/^[^\s]+\s/, '') || 'Demande de vérification'}`)
                .setFooter({ text: `Blacklisté par ${interaction.user.tag} · ${new Date().toLocaleString('fr-FR')}` })
            : interaction.message.embeds[0]],
        }).catch(() => {});

        await logSanction(interaction.guild, [
          { name: 'Membre', value: member.user.tag,           inline: true },
          { name: 'Par',    value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Motif',  value: 'Blacklist lors vérification', inline: false },
        ], `Blacklist Vérif — ${member.user.tag}`, '#8B0000');

      } catch (err) {
        return interaction.reply({ content: `Erreur : ${err.message}`, ephemeral: true });
      }
      return;
    }
  }

  // ── Boutons de RATING ──────────────────────────────────────
  if (customId.startsWith('rate_')) {
    const parts  = customId.split('_');
    const voteId = parts[1];
    const choice = parts[2];

    if (voteId === 'expired') {
      return interaction.reply({ content: 'Ce vote a expiré.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !hasRatingRole(member)) {
      return interaction.reply({ content: 'Tu n\'as pas le rôle requis pour voter.', ephemeral: true });
    }

    const db     = await getGymgirls();
    const active = db.activeVotes?.[interaction.channel.id];

    if (!active || active.voteId !== voteId) {
      return interaction.reply({ content: 'Ce vote n\'est plus actif ou a expiré.', ephemeral: true });
    }
    if (active.votedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Tu as déjà voté sur ce duel.', ephemeral: true });
    }

    if (choice === 'skip') {
      active.votedUsers.push(interaction.user.id);
      await saveGymgirls(db);
      return interaction.reply({ content: '⏭️ Skip enregistré.', ephemeral: true });
    }

    const girlA   = (db.girls || []).find(g => g.id === active.girlAId);
    const girlB   = (db.girls || []).find(g => g.id === active.girlBId);
    if (!girlA || !girlB) return interaction.reply({ content: 'Erreur : données corrompues.', ephemeral: true });

    const winner = choice === 'A' ? girlA : girlB;
    const loser  = choice === 'A' ? girlB : girlA;

    const K         = 32;
    const expectedW = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const gainW     = Math.round(K * (1 - expectedW));
    const gainL     = Math.round(K * (0 - (1 - expectedW)));

    const prevWinnerElo = winner.elo;
    const prevLoserElo  = loser.elo;

    winner.elo  = Math.max(100, winner.elo + gainW);
    loser.elo   = Math.max(100, loser.elo + gainL);
    winner.wins++;
    loser.losses++;

    active.votedUsers.push(interaction.user.id);
    await saveGymgirls(db);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#00FF66')
        .setTitle('Vote enregistré ✅')
        .setDescription(
          `Tu as voté pour **${winner.name}**.\n\n` +
          `**${winner.name}** \`${prevWinnerElo}\` → \`${winner.elo}\` **(+${gainW})**\n` +
          `**${loser.name}** \`${prevLoserElo}\` → \`${loser.elo}\` **(${gainL})**`
        )
        .setFooter({ text: `K=32 · Votes sur ce duel : ${active.votedUsers.length}` })],
      ephemeral: true,
    });

    return;
  }

  // ── Boutons de TOURNOI ─────────────────────────────────────
  if (!customId.startsWith('tournament_')) return;

  if (!isAdmin(interaction.user.id)) {
    return interaction.reply({ content: 'Seul Crous peut voter.', ephemeral: true });
  }

  const parts        = customId.split('_');
  const choice       = parts[parts.length - 1];
  const matchIndex   = parseInt(parts[parts.length - 2]);
  const tournamentId = parts.slice(1, parts.length - 2).join('_');

  const t = tournamentsData[tournamentId];
  if (!t || t.status !== 'active') return interaction.reply({ content: 'Ce tournoi n\'est plus actif.', ephemeral: true });
  if (matchIndex !== t.currentMatchIndex) return interaction.reply({ content: 'Ce vote est obsolete.', ephemeral: true });

  const [p1, p2] = t.currentPairs[matchIndex];
  const winner   = choice === 'A' ? p1 : p2;
  const loser    = choice === 'A' ? p2 : p1;

  t.roundWinners.push(winner);
  t.history.push({ round: t.currentRound, match: matchIndex + 1, winner, loser, bye: false });
  t.currentMatchIndex++; saveTournaments();

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('done_A').setLabel(choice === 'A' ? 'Joueur A (Gagnant)' : 'Joueur A').setStyle(choice === 'A' ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('done_B').setLabel(choice === 'B' ? 'Joueur B (Gagnant)' : 'Joueur B').setStyle(choice === 'B' ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true),
  );

  await interaction.update({ components: [disabledRow] }).catch(() => {});
  await interaction.channel.send({ embeds: [embed('#00FF66').setTitle(`Match ${matchIndex + 1} -- Resultat`).addFields(
    { name: 'Gagnant', value: `<@${winner.userId}> (${winner.username})`, inline: true },
    { name: 'Elimine', value: `<@${loser.userId}> (${loser.username})`,   inline: true },
  )] });

  await advanceTournament(tournamentId, interaction.channel);
});

// ============================================================
//  HANDLER MESSAGES
// ============================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ── LIKE AUTO ───────────────────────────────────────────────
  if (likeEnabled && message.author.id === LIKE_TARGET_USER_ID) {
    try { await message.react('❤️'); } catch (err) { console.warn('[LIKE AUTO] Impossible de réagir :', err.message); }
  }

  // ── ANTI-BADWORDS ────────────────────────────────────────────
  if (!isAdmin(message.author.id) && badwordsData.words.length > 0) {
    const content = message.content.toLowerCase();
    const found = badwordsData.words.find(w => content.includes(w.toLowerCase()));
    if (found) {
      await message.delete().catch(() => {});
      if (!warnsData[message.author.id]) warnsData[message.author.id] = [];
      warnsData[message.author.id].push({ reason: 'Mot interdit détecté (auto)', by: client.user.id, at: new Date().toISOString() });
      saveWarns();
      const bwMsg = await message.channel.send({
        embeds: [embed('#FF4444').setTitle('⛔ Message supprimé — Mot interdit')
          .setDescription(`<@${message.author.id}>, ton message contient un mot interdit et a été supprimé. Un warn automatique a été ajouté.`)
          .addFields({ name: 'Warns', value: `${warnsData[message.author.id].length}/3`, inline: true })
          .setFooter({ text: 'Anti-BadWords automatique' })]
      }).catch(() => null);
      if (bwMsg) setTimeout(() => bwMsg.delete().catch(() => {}), 8000);
      return;
    }
  }

  if (!message.content.startsWith(CONFIG.PREFIX)) return;

  const [rawCmd, ...args] = message.content.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();

  if (commands[cmd]) {
    try { await commands[cmd](message, args); }
    catch (e) { console.error(`Erreur commande ${cmd}:`, e); message.reply('Une erreur est survenue.'); }
    return;
  }

  const ruleMatch = cmd.match(/^!regle(\d+)$/);
  if (ruleMatch) {
    const num = ruleMatch[1];
    if (rulesData[num]) {
      await message.reply({ embeds: [embed('#FAD961').setTitle(`Regle ${num}`).setDescription(rulesData[num])] });
    } else {
      await message.reply(`La regle **${num}** n'existe pas. Utilise \`!regles\` pour voir toutes les regles.`);
    }
  }
});

// ============================================================
//  REACTION ROLES (dont vérification manuelle)
// ============================================================

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial)         { try { await reaction.fetch();         } catch { return; } }
  if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }

  const msgId     = reaction.message.id;
  const emojiName = reaction.emoji.name;
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;

  // ── Message de vérification principal ──
  if (msgId === MESSAGE_ID && reaction.message.channel.id === CHANNEL_ID && emojiName === EMOJI) {
    const guild  = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    // Vérifier si blacklisté
    if (blacklistData[user.id]) {
      console.log(`[VERIF] ${user.tag} est blacklisté — rejet automatique`);
      try { await reaction.users.remove(user.id); } catch {}
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🚫 Accès refusé')
            .setDescription('Tu es sur la liste noire de ce serveur et ne peux pas rejoindre.')],
        });
      } catch {}
      // Kick discret
      await member.kick('Blacklisté — tentative de rejoindre le serveur').catch(() => {});
      return;
    }

    // Mode vérification manuelle activé
    if (verifConfig.enabled && verifConfig.pendingRoleId) {
      const pendingRole = guild.roles.cache.get(verifConfig.pendingRoleId);
      if (!pendingRole) {
        console.error('[VERIF] Rôle pending introuvable :', verifConfig.pendingRoleId);
        return;
      }

      // Déjà en attente ?
      if (pendingVerifs[user.id]) {
        console.log(`[VERIF] ${user.tag} a déjà une demande en attente`);
        return;
      }

      // Déjà approuvé ?
      if (verifConfig.approvedRoleId && member.roles.cache.has(verifConfig.approvedRoleId)) {
        console.log(`[VERIF] ${user.tag} est déjà approuvé`);
        return;
      }

      try {
        await member.roles.add(pendingRole, 'En attente de vérification manuelle');
        console.log(`[VERIF] Rôle pending attribué à ${user.tag}`);

        // Message dans le channel de vérif
        if (verifConfig.verifChannelId) {
          const verifCh = guild.channels.cache.get(verifConfig.verifChannelId);
          if (verifCh) {
            await verifCh.send({
              content: `<@${user.id}>`,
              embeds: [new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⏳ Vérification en cours')
                .setDescription(
                  'Bienvenue ! Tu es actuellement en attente de vérification par le staff.\n\n' +
                  '> Un admin va examiner ton profil et te donner accès au serveur.\n' +
                  '> Merci de patienter — cela peut prendre quelques heures.\n\n' +
                  'En cas de problème, contacte un admin directement.'
                )
                .setFooter({ text: 'Ne quitte pas le serveur, tu perdrais ton statut de vérification' })],
            }).catch(() => {});
          }
        }

        // Envoyer la demande aux admins
        await sendVerifRequest(guild, member);

      } catch (err) {
        console.error('[VERIF] Erreur attribution rôle pending :', err.message);
      }
      return;
    }

    // Mode classique (pas de vérification manuelle)
    try {
      const role = guild.roles.cache.get(ROLE_ID);
      if (!role) return console.error('[REACTION ROLE] Role introuvable :', ROLE_ID);
      await member.roles.add(role);
      try { await user.send('Tu as bien recu l\'acces au serveur ! Bienvenue !'); } catch {}
    } catch (err) { console.error('[REACTION ROLE] Erreur :', err.message); }
    return;
  }

  // ── Multi-RR classique ──
  if (reactionRolesData[msgId]) {
    const roleId = reactionRolesData[msgId].roles[emojiName];
    if (!roleId) return;
    try {
      const member = await reaction.message.guild.members.fetch(user.id);
      const role   = reaction.message.guild.roles.cache.get(roleId);
      if (!role) return;
      await member.roles.add(role);
    } catch (err) { console.error('[MULTI-RR] Erreur ajout role :', err.message); }
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial)         { try { await reaction.fetch();         } catch { return; } }
  if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }

  const msgId     = reaction.message.id;
  const emojiName = reaction.emoji.name;
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;

  if (msgId === MESSAGE_ID && reaction.message.channel.id === CHANNEL_ID && emojiName === EMOJI) {
    try {
      const member = await reaction.message.guild.members.fetch(user.id);
      const role   = reaction.message.guild.roles.cache.get(ROLE_ID);
      if (!role) return;
      await member.roles.remove(role);
    } catch (err) { console.error('[REACTION ROLE] Erreur :', err.message); }
    return;
  }

  if (reactionRolesData[msgId]) {
    const roleId = reactionRolesData[msgId].roles[emojiName];
    if (!roleId) return;
    try {
      const member = await reaction.message.guild.members.fetch(user.id);
      const role   = reaction.message.guild.roles.cache.get(roleId);
      if (!role) return;
      await member.roles.remove(role);
    } catch (err) { console.error('[MULTI-RR] Erreur retrait role :', err.message); }
  }
});

// ============================================================
//  GUILDMEMBERADD — Vérification blacklist à l'arrivée
// ============================================================

client.on('guildMemberAdd', async (member) => {
  // Si le membre est blacklisté, on le kick immédiatement
  if (blacklistData[member.id]) {
    console.log(`[VERIF] Membre blacklisté détecté à l'arrivée : ${member.user.tag}`);
    try {
      await member.send({
        embeds: [new EmbedBuilder()
          .setColor('#8B0000')
          .setTitle('🚫 Accès refusé')
          .setDescription('Tu es sur la liste noire de ce serveur.')],
      }).catch(() => {});
      await member.kick('Blacklisté — entrée bloquée automatiquement');
    } catch (err) {
      console.error('[VERIF] Erreur kick blacklist :', err.message);
    }

    // Notifier dans le log
    if (verifConfig.logChannelId) {
      const logCh = member.guild.channels.cache.get(verifConfig.logChannelId);
      if (logCh) {
        await logCh.send({
          embeds: [new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🚫 Tentative d\'accès — Blacklisté')
            .setDescription(`<@${member.id}> (${member.user.tag}) a tenté de rejoindre mais est blacklisté.`)
            .addFields(
              { name: 'ID', value: member.id, inline: true },
              { name: 'Blacklisté le', value: new Date(blacklistData[member.id].at).toLocaleString('fr-FR'), inline: true },
              { name: 'Raison', value: blacklistData[member.id].reason, inline: false },
            )
            .setTimestamp()],
        }).catch(() => {});
      }
    }
    return; // Ne pas envoyer le message de bienvenue à un blacklisté
  }

  // ── MESSAGE DE BIENVENUE AUTOMATIQUE ─────────────────────────
  if (welcomeConfig.channelId && welcomeConfig.message) {
    const welcomeCh = member.guild.channels.cache.get(welcomeConfig.channelId);
    if (welcomeCh) {
      const msg = welcomeConfig.message
        .replace(/{user}/g,   `<@${member.id}>`)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g,  member.guild.memberCount);
      await welcomeCh.send({
        embeds: [new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('⚡ Nouveau membre !')
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp()
          .setFooter({ text: `Membre #${member.guild.memberCount} · ${member.guild.name}` })]
      }).catch(() => {});
    }
  }
});

// ============================================================
//  TIKTOK LIVE CHECKER
// ============================================================

let liveDetectionStreak    = 0;
const LIVE_DETECTION_THRESHOLD = 2;

async function checkTikTokLive() {
  try {
    const headers = {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control':   'no-cache',
      'Pragma':          'no-cache',
      'Sec-Fetch-Mode':  'navigate',
    };
    const response = await axios.get(`https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, { headers, timeout: 15000, maxRedirects: 5 });
    const html     = response.data;
    const patterns = [
      /"statusStr"\s*:\s*"LIVE_STATUS_STREAMING"/.test(html),
      /"isLiveStreaming"\s*:\s*true/.test(html),
      /"liveRoomInfo"/.test(html) && /"status"\s*:\s*2/.test(html),
      /roomid[^"]*"[^"]{5,}/.test(html) && !/redirectUrl/.test(html),
      /"liveUrl"/.test(html) && !/"liveUrl"\s*:\s*""/.test(html),
    ];
    const positiveSignals  = patterns.filter(Boolean).length;
    const isCurrentlyLive  = positiveSignals >= 2;

    console.log(`[LIVE CHECK] @${CONFIG.TIKTOK_USERNAME} -- ${positiveSignals}/5 signaux -- Streak: ${liveDetectionStreak}`);

    const channel = client.channels.cache.get(CONFIG.LIVE_CHANNEL_ID);
    if (!channel) { console.error(`[LIVE] Channel ${CONFIG.LIVE_CHANNEL_ID} introuvable.`); return; }

    if (isCurrentlyLive) {
      liveDetectionStreak++;
      if (liveDetectionStreak >= LIVE_DETECTION_THRESHOLD && !liveStatus.isLive) {
        liveStatus.isLive = true; liveStatus.lastNotified = new Date().toISOString(); saveJSON(FILES.liveStatus, liveStatus);
        await channel.send({ content: `@everyone **@${CONFIG.TIKTOK_USERNAME}** est en live sur TikTok !`,
          embeds: [embed('#FF0050').setTitle('LIVE EN COURS !')
            .setDescription(`**@${CONFIG.TIKTOK_USERNAME}** est actuellement en **live** sur TikTok !\n\nClique sur le lien ci-dessous pour rejoindre le live.`)
            .addFields(
              { name: 'Lien direct', value: `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, inline: false },
              { name: 'Detecte a',   value: `<t:${Math.floor(Date.now() / 1000)}:T>`,                 inline: true  },
            ).setThumbnail(`https://unavatar.io/tiktok/${CONFIG.TIKTOK_USERNAME}`)
            .setFooter({ text: `TikTok Live Detector - @${CONFIG.TIKTOK_USERNAME}` })] });
      }
    } else {
      if (liveDetectionStreak > 0) { liveDetectionStreak = 0; }
      if (liveStatus.isLive) { liveStatus.isLive = false; saveJSON(FILES.liveStatus, liveStatus); }
    }
  } catch (err) {
    if (err.response?.status === 429) { console.warn('[LIVE] Rate limit TikTok.'); }
    else if (err.response?.status === 404) { console.warn(`[LIVE] Page TikTok introuvable.`); }
    else { console.error('[LIVE] Erreur :', err.message); }
  }
}

// ============================================================
//  RESTAURATION DES TIMERS AU DÉMARRAGE
// ============================================================

async function restoreTimers() {
  const now = Date.now();

  for (const [userId, data] of Object.entries(jailsData)) {
    const remaining    = data.until - now;
    const savedRoleIds = data.savedRoleIds || (data.hadRole ? [CONFIG.JAIL_ACCESS_ROLE_ID] : []);
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        if (!guild) { delete jailsData[userId]; continue; }
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) await unjailMember(member, savedRoleIds, 'Liberation automatique (rattrapage demarrage)');
      } catch (err) { console.error('[RESTORE JAIL] Erreur :', err.message); }
      delete jailsData[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          if (!guild) { delete jailsData[userId]; saveJails(); return; }
          const member = await guild.members.fetch(userId).catch(() => null);
          const saved  = jailsData[userId];
          if (member && saved) await unjailMember(member, saved.savedRoleIds || [], 'Liberation automatique apres jail');
          delete jailsData[userId]; saveJails();
          const prisonCh = guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
          if (prisonCh) await prisonCh.send({ embeds: [embed('#00FF66').setTitle('Libere !').setDescription(`<@${userId}> a purge sa peine.`)] }).catch(() => {});
        } catch (err) { console.error('[RESTORE JAIL] Erreur liberation :', err.message); }
      }, remaining);
    }
  }
  saveJails();

  for (const [userId, data] of Object.entries(npcList)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        if (member) await member.setNickname(data.originalNick === member.user.username ? null : data.originalNick, 'Fin NPC (rattrapage demarrage)');
      } catch {} delete npcList[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
          if (member) await member.setNickname(data.originalNick === member.user.username ? null : data.originalNick, 'Fin du statut NPC');
          delete npcList[userId]; saveNpcList();
        } catch {}
      }, remaining);
    }
  }
  saveNpcList();

  for (const [userId, data] of Object.entries(tfList)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        if (member) await member.setNickname(data.originalNick === member.user.username ? null : data.originalNick, 'Fin TF (rattrapage demarrage)');
      } catch {} delete tfList[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
          if (member) await member.setNickname(data.originalNick === member.user.username ? null : data.originalNick, 'Fin du TF');
          delete tfList[userId]; saveTfList();
        } catch {}
      }, remaining);
    }
  }
  saveTfList();

  // Nettoyer les votes actifs expirés dans JSONBin au redémarrage
  try {
    const db = await getGymgirls();
    let changed = false;
    for (const [channelId, vote] of Object.entries(db.activeVotes || {})) {
      if (Date.now() - vote.createdAt > 5 * 60 * 1000) {
        delete db.activeVotes[channelId]; changed = true;
      }
    }
    if (changed) await saveGymgirls(db);
  } catch (err) { console.error('[RESTORE] Erreur nettoyage votes :', err.message); }

  console.log('[RESTORE] Timers restaures avec succes.');
}

// ============================================================
//  DÉMARRAGE
// ============================================================

client.once('ready', async () => {
  console.log(`Bot connecte en tant que ${client.user.tag}`);
  console.log(`Admins: ${CONFIG.ADMIN_IDS.join(', ')}`);
  console.log(`Surveillance TikTok: @${CONFIG.TIKTOK_USERNAME}`);
  console.log(`Channel live: ${CONFIG.LIVE_CHANNEL_ID}`);
  console.log(`Rating role: ${CONFIG.RATING_ROLE_ID}`);
  console.log(`JSONBin ID: ${_binId || 'sera cree au premier !rate-add'}`);
  console.log(`Multi-RR charges: ${Object.keys(reactionRolesData).length} message(s)`);
  console.log(`Ticket viewer role: ${ticketConfig.viewRoleId  || 'non defini'}`);
  console.log(`Ticket staff role:  ${ticketConfig.staffRoleId || 'non defini'}`);
  console.log(`Tickets actifs: ${Object.keys(ticketsData).length}`);
  console.log(`Jail prison channel: ${CONFIG.JAIL_PRISON_CHANNEL_ID}`);
  console.log(`Sanction log channel: ${sanctionLogData.channelId || 'non defini'}`);
  console.log(`Warns charges: ${Object.keys(warnsData).length} membre(s)`);
  console.log(`Jails actifs: ${Object.keys(jailsData).length}`);
  console.log(`[VERIF] Système: ${verifConfig.enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log(`[VERIF] Blacklist: ${Object.keys(blacklistData).length} entrée(s)`);
  console.log(`[VERIF] En attente: ${Object.keys(pendingVerifs).length} demande(s)`);

  await restoreTimers();
  checkTikTokLive();
  setInterval(checkTikTokLive, CONFIG.LIVE_CHECK_INTERVAL);
});

client.on('error', (err) => console.error('[Discord] Erreur client:', err));

// Ajouter GuildMembers intent pour guildMemberAdd
// Note : assurez-vous d'avoir activé "Server Members Intent" dans le portail dev Discord

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('DISCORD_TOKEN manquant !'); process.exit(1); }

client.login(TOKEN);
