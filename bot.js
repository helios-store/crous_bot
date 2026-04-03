const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ============================================================
//  ⚙️  CONFIGURATION — À MODIFIER
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

  // Reaction role simple (vérification)
  REACTION_ROLE: {
    MESSAGE_ID: '1488290011425149022',
    CHANNEL_ID: '1488289976540991770',
    ROLE_ID:    '1487674672865611806',
    EMOJI:      '✅',
  },

  // Jail
  JAIL_ACCESS_ROLE_ID: '1487674672865611806',
  JAIL_PRISON_CHANNEL_ID: '1489385660979872005',
  JAIL_DURATION_MS: 5 * 60 * 1000,
};

// ============================================================
//  📁  CHEMINS DES FICHIERS DE DONNÉES
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
};

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
//  📦  DONNÉES
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
  1: "Pas de demande de source : Il est interdit de demander, vendre ou partager des sources de stéroïdes, peptides ou autres substances dopantes.",
  2: "Aucune discrimination : Les propos racistes, homophobes, sexistes ou discriminatoires sont strictement interdits sauf sur les iqlet.",
  3: "Respect obligatoire : Tout le monde doit être respecté. Les insultes, provocations, harcèlement ou comportements toxiques ne sont pas tolérés sauf si la personne est sous système fluide.",
  4: "Pas de spam : Le spam, flood, messages répétés, ou abus de majuscules sont interdits.",
  5: "Publicité interdite : Pas de promotion de chaînes, serveurs, produits ou services sans l'autorisation du staff.",
  6: "Contenu inapproprié : Les contenus NSFW, choquants ou illégaux sont interdits.",
  7: "Restez dans les bons salons : Merci d'utiliser les salons appropriés pour chaque sujet.",
  8: "Respect du staff : Les décisions du staff doivent être respectées.",
});

let liveStatus      = loadJSON(FILES.liveStatus,    { isLive: false, lastNotified: null });
let reactionRolesData = loadJSON(FILES.reactionRoles, {});
let ticketsData     = loadJSON(FILES.tickets,        {});
let warnsData       = loadJSON(FILES.warns,          {}); // { userId: [{ reason, by, at }] }
let jailsData       = loadJSON(FILES.jails,          {}); // { userId: { until, hadRole, guildId } }
let sanctionLogData = loadJSON(FILES.sanctionLog,    { channelId: null });
let npcList         = loadJSON(FILES.npcList,        {}); // { userId: { originalNick, until } }
let tfList          = loadJSON(FILES.tfList,         {}); // { userId: { originalNick, until } }

let ticketConfig = loadJSON(FILES.ticketConfig, {
  viewRoleId: null,
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

function isAdmin(userId) { return CONFIG.ADMIN_IDS.includes(userId); }
function embed(color = '#5865F2') { return new EmbedBuilder().setColor(color).setTimestamp(); }

// ============================================================
//  📢  SANCTION LOG HELPER
// ============================================================

async function logSanction(guild, fields, title, color = '#FF4444') {
  if (!sanctionLogData.channelId) return;
  try {
    const logChannel = await guild.channels.fetch(sanctionLogData.channelId).catch(() => null);
    if (!logChannel) return;
    const e = embed(color).setTitle(`🔐 ${title}`).addFields(fields).setFooter({ text: 'Sanction Log' });
    await logChannel.send({ embeds: [e] });
  } catch (err) {
    console.error('[SANCTION LOG] Erreur envoi log :', err.message);
  }
}

// ============================================================
//  🔄  HELPER — Met à jour l'embed du message RR
// ============================================================

async function updateRREmbed(targetMessage, rrEntry) {
  if (rrEntry.existingMessage) return;
  const rolesList = Object.entries(rrEntry.roles)
    .map(([emoji, roleId]) => `${emoji} — <@&${roleId}>`)
    .join('\n') || '*Aucun rôle configuré.*';
  const updatedEmbed = embed('#7289DA')
    .setTitle(`🎭 ${rrEntry.titre}`)
    .setDescription(rrEntry.description)
    .addFields({ name: '📋 Rôles disponibles', value: rolesList, inline: false })
    .setFooter({ text: 'Réagis pour obtenir un rôle • Retire ta réaction pour le perdre' });
  await targetMessage.edit({ embeds: [updatedEmbed] });
}

// ============================================================
//  📚  COMMANDES
// ============================================================

const commands = {

  // ============================================================
  //  📖  AIDE — VERSION REMANIÉE
  // ============================================================

  '!aide': async (message) => {
    const viewRoleDisplay  = ticketConfig.viewRoleId  ? `<@&${ticketConfig.viewRoleId}>`  : '`non défini`';
    const staffRoleDisplay = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '`non défini`';
    const logChannelDisplay = sanctionLogData.channelId ? `<#${sanctionLogData.channelId}>` : '`non défini`';

    // ── Page 1 : Commandes générales ──
    const e1 = embed('#5865F2')
      .setTitle('📖  Aide — Commandes générales')
      .setDescription('Préfixe : `!` — Les commandes marquées 🔒 sont réservées aux admins.')
      .addFields(
        {
          name: '🔬  Études & Suppléments',
          value: [
            '`!pubmed` — Affiche la dernière étude enregistrée',
            '`!def-etude <titre> | <url> | <desc>` 🔒 — Définit une nouvelle étude',
            '`!cope` — Liste complète des compléments (cope / intéressants)',
            '`!cope-du-jour` — Tire un cope aléatoire avec réfutation scientifique',
            '`!add-cope <nom>` 🔒 / `!remove-cope <nom>` 🔒',
            '`!add-interesting <nom>` 🔒 / `!remove-interesting <nom>` 🔒',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📜  Règles',
          value: [
            '`!regles` — Affiche toutes les règles',
            '`!regle<N>` — Affiche la règle numéro N (ex: `!regle3`)',
            '`!set-regle <N> | <texte>` 🔒 — Modifie une règle',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📢  Annonces',
          value: '`!say <#channel> | <titre> | <desc> | [couleur] | [image] | [footer]` 🔒',
          inline: false,
        },
        {
          name: '🔴  Live TikTok',
          value: 'Détection automatique des lives — aucune commande requise.',
          inline: false,
        },
        {
          name: '🎵  ASMR',
          value: '`!mommy-asmr` — *Accès restreint aux IDs autorisés*',
          inline: false,
        },
        {
          name: '🎮  Fun & Troll',
          value: [
            '`!iqtest [@user]` — Test de QI certifié fluide™',
            '`!fluide @user` 🔒 — Place un membre sous système fluide',
            '`!tf @user` 🔒 — Renomme trollement un membre 10 min',
            '`!npc @user` 🔒 — Déclare un membre NPC pour 10 min',
            '`!resetpseudo @user` 🔒 — Réinitialise le surnom d\'un membre',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Page 1 / 3 — Tape !aide2 pour la modération, !aide3 pour tickets & RR' });

    // ── Page 2 : Modération ──
    const e2 = embed('#FF4444')
      .setTitle('🔨  Aide — Modération')
      .setDescription('Toutes les commandes de cette page sont réservées aux admins 🔒 sauf mention contraire.')
      .addFields(
        {
          name: '⚠️  Système de warns',
          value: [
            '`!warn @user [raison]` — Avertit un membre (auto-jail au 3ème warn)',
            '`!warns @user` — Affiche l\'historique des warns d\'un membre',
            '`!clearwarns @user` — Supprime tous les warns d\'un membre',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⛓️  Jail',
          value: [
            '`!jail @user` — Emprisonne un membre pendant 5 minutes',
            '`!expiredjails` — Liste les jails actifs avec temps restant',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔇  Mutes automatiques',
          value: [
            '`!source` — Auto-mute 10 min si utilisé par un non-admin (règle 1)',
            '`!mk677` — Auto-mute 10 min si utilisé par un non-admin (règle 1)',
            '`!ban @user [raison]` — Bannit définitivement un membre',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📋  Logs de sanctions',
          value: [
            `'!sanction-log <#channel>'\` 🔒 — Définit le salon de logs`,
            `Salon actuel : ${logChannelDisplay}`,
            '_Toutes les sanctions (warn, jail, ban) y sont automatiquement enregistrées._',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Page 2 / 3 — Tape !aide pour les commandes générales, !aide3 pour tickets & RR' });

    // ── Page 3 : Tickets & Reaction Roles ──
    const e3 = embed('#7289DA')
      .setTitle('🎫  Aide — Tickets & Reaction Roles')
      .addFields(
        {
          name: '🎫  Tickets',
          value: [
            '`!ticket <motif>` — Ouvre un ticket privé',
            '`!fermer` — Ferme le ticket (depuis le salon ticket)',
            '`!ticket-setrole @role` 🔒 — Rôle qui **voit** les tickets (lecture seule)',
            '`!ticket-setstaff @role` 🔒 — Rôle qui peut **écrire** dans les tickets',
            '`!ticket-config` 🔒 — Affiche la configuration actuelle',
            `Viewer : ${viewRoleDisplay} | Staff : ${staffRoleDisplay}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎭  Reaction Roles',
          value: [
            '`!rr-setup <#channel> | <titre> | <desc>` 🔒 — Crée un message RR',
            '`!rr-attach <msgID> <#channel> | <titre> | <desc>` 🔒 — Attache à un message existant',
            '`!rr-add <msgID> | <emoji> | <@role>` 🔒 — Ajoute un emoji/rôle',
            '`!rr-remove <msgID> | <emoji>` 🔒 — Retire un emoji/rôle',
            '`!rr-list` 🔒 — Liste tous les messages RR configurés',
            '`!rr-delete <msgID>` 🔒 — Supprime un message RR',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Page 3 / 3 — Tape !aide pour les commandes générales, !aide2 pour la modération' });

    await message.reply({ embeds: [e1] });
    await message.channel.send({ embeds: [e2] });
    await message.channel.send({ embeds: [e3] });
  },

  // ── Alias pages ──
  '!aide2': async (message) => { await commands['!aide'](message); },
  '!aide3': async (message) => { await commands['!aide'](message); },

  // ============================================================
  //  📢  SAY
  // ============================================================

  '!say': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    try { await message.delete(); } catch {}
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) {
      try {
        const errMsg = await message.channel.send('❌ Format : `!say <#channel> | <titre> | <description> | [couleur] | [image_url] | [footer]`');
        setTimeout(() => errMsg.delete().catch(() => {}), 8000);
      } catch {}
      return;
    }
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) {
      try {
        const errMsg = await message.channel.send('❌ Mentionne un salon valide en premier paramètre.');
        setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      } catch {}
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
      try {
        const errMsg = await message.channel.send(`❌ Impossible d'envoyer dans ce salon : ${err.message}`);
        setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      } catch {}
    }
  },

  // ============================================================
  //  ⚠️  WARNS
  // ============================================================

  '!warn': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!warn @user [raison]`');
    if (isAdmin(target.id)) return message.reply('❌ Tu ne peux pas warn un admin.');

    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    if (!warnsData[target.id]) warnsData[target.id] = [];
    warnsData[target.id].push({ reason, by: message.author.id, at: new Date().toISOString() });
    saveWarns();

    const warnCount = warnsData[target.id].length;

    const warnEmbed = embed('#FFA500')
      .setTitle(`⚠️ Avertissement — Warn ${warnCount}/3`)
      .setDescription(`<@${target.id}> a reçu un avertissement.`)
      .addFields(
        { name: '📌 Raison',    value: reason,                      inline: false },
        { name: '👮 Par',       value: `<@${message.author.id}>`,   inline: true  },
        { name: '🔢 Total',     value: `${warnCount} warn(s)`,      inline: true  },
      )
      .setFooter({ text: warnCount >= 3 ? '⛓️ 3 warns atteints — Jail automatique déclenché !' : `${3 - warnCount} warn(s) avant jail automatique` });

    await message.reply({ embeds: [warnEmbed] });

    await logSanction(message.guild, [
      { name: '👤 Membre',  value: `<@${target.id}>`,            inline: true },
      { name: '👮 Par',     value: `<@${message.author.id}>`,    inline: true },
      { name: '📌 Raison',  value: reason,                       inline: false },
      { name: '🔢 Total',   value: `${warnCount}/3`,             inline: true },
    ], `⚠️ Warn #${warnCount} — ${target.user.tag}`, '#FFA500');

    // Auto-jail au 3ème warn
    if (warnCount >= 3) {
      const accessRole = message.guild.roles.cache.get(CONFIG.JAIL_ACCESS_ROLE_ID);
      const prisonChannel = message.guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
      const hadRole = target.roles.cache.has(CONFIG.JAIL_ACCESS_ROLE_ID);
      const dureeMin = Math.round(CONFIG.JAIL_DURATION_MS / 60000);

      try {
        if (hadRole && accessRole) await target.roles.remove(accessRole, 'Auto-jail (3 warns)');

        jailsData[target.id] = {
          until: Date.now() + CONFIG.JAIL_DURATION_MS,
          hadRole,
          guildId: message.guild.id,
        };
        saveJails();

        const autoJailEmbed = embed('#FF4444')
          .setTitle('⛓️ Jail automatique — 3 warns atteints')
          .setDescription(`<@${target.id}> a été automatiquement emprisonné pour **${dureeMin} minutes** suite à son 3ème warn.`)
          .setFooter({ text: 'Réfléchis à tes actes.' });

        await message.channel.send({ embeds: [autoJailEmbed] });

        if (prisonChannel) {
          await prisonChannel.send({
            content: `<@${target.id}>`,
            embeds: [embed('#FF4444')
              .setTitle('🔒 Jail automatique')
              .setDescription(`Tu as accumulé 3 warns. Tu es emprisonné pour **${dureeMin} min**.`)
            ],
          });
        }

        await logSanction(message.guild, [
          { name: '👤 Membre',  value: `<@${target.id}>`,          inline: true },
          { name: '⏱️ Durée',  value: `${dureeMin} min`,           inline: true },
          { name: '📌 Motif',   value: 'Auto-jail (3 warns)',       inline: false },
        ], `⛓️ Jail auto — ${target.user.tag}`, '#FF4444');

        setTimeout(async () => {
          try {
            const member = await message.guild.members.fetch(target.id).catch(() => null);
            if (!member) return;
            if (hadRole && accessRole && !member.roles.cache.has(CONFIG.JAIL_ACCESS_ROLE_ID)) {
              await member.roles.add(accessRole, 'Libération automatique après jail');
            }
            delete jailsData[target.id];
            saveJails();
            if (prisonChannel) {
              await prisonChannel.send({
                embeds: [embed('#00FF66').setTitle('🔓 Libéré !').setDescription(`<@${target.id}> a été libéré automatiquement.`)],
              });
            }
          } catch (err) { console.error('[AUTO-JAIL] Erreur libération :', err.message); }
        }, CONFIG.JAIL_DURATION_MS);

      } catch (err) {
        console.error('[WARN AUTO-JAIL] Erreur :', err.message);
      }
    }
  },

  '!warns': async (message) => {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!warns @user`');
    const list = warnsData[target.id];
    if (!list || list.length === 0) return message.reply(`✅ <@${target.id}> n'a aucun warn.`);

    const fields = list.map((w, i) => ({
      name: `Warn #${i + 1} — ${new Date(w.at).toLocaleDateString('fr-FR')}`,
      value: `📌 ${w.reason}\n👮 <@${w.by}>`,
      inline: false,
    }));

    await message.reply({
      embeds: [embed('#FFA500')
        .setTitle(`⚠️ Warns de ${target.displayName} — ${list.length}/3`)
        .addFields(fields)
      ],
    });
  },

  '!clearwarns': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!clearwarns @user`');
    const before = warnsData[target.id]?.length || 0;
    delete warnsData[target.id];
    saveWarns();
    await message.reply(`✅ **${before}** warn(s) supprimé(s) pour <@${target.id}>.`);

    await logSanction(message.guild, [
      { name: '👤 Membre',   value: `<@${target.id}>`,          inline: true },
      { name: '👮 Par',      value: `<@${message.author.id}>`,  inline: true },
      { name: '🗑️ Supprimés', value: `${before} warn(s)`,      inline: true },
    ], `🧹 Warns effacés — ${target.user.tag}`, '#00FF66');
  },

  // ============================================================
  //  ⛓️  EXPIREDJAILS
  // ============================================================

  '!expiredjails': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const active = Object.entries(jailsData);
    if (active.length === 0) return message.reply('✅ Aucun jail actif en ce moment.');

    const now = Date.now();
    const fields = active.map(([userId, data]) => {
      const remaining = data.until - now;
      const displayTime = remaining > 0
        ? `⏱️ ${Math.ceil(remaining / 1000 / 60)} min restante(s)`
        : '⚠️ Libération en attente...';
      return {
        name: `<@${userId}>`,
        value: `${displayTime}\n📅 Fin : ${new Date(data.until).toLocaleTimeString('fr-FR')}`,
        inline: true,
      };
    });

    await message.reply({
      embeds: [embed('#FF4444').setTitle(`⛓️ Jails actifs — ${active.length} membre(s)`).addFields(fields)],
    });
  },

  // ============================================================
  //  📋  SANCTION LOG
  // ============================================================

  '!sanction-log': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('❌ Mentionne un salon : `!sanction-log <#channel>`');
    sanctionLogData.channelId = channel.id;
    saveSanctionLog();
    await message.reply(`✅ Salon de logs des sanctions défini : ${channel}\nToutes les sanctions (warn, jail, ban) y seront automatiquement enregistrées.`);
  },

  // ============================================================
  //  🌀  NPC
  // ============================================================

  '!npc': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!npc @user`');
    if (isAdmin(target.id)) return message.reply('❌ Tu ne peux pas npc-ifier un admin.');

    const NPC_DURATION_MS = 10 * 60 * 1000;
    const dureeMin = Math.round(NPC_DURATION_MS / 60000);
    const originalNick = target.nickname || target.user.username;
    const npcNames = [
      'NPC #4782', 'NPC #0001', 'NPC Villageois', 'NPC Background',
      'NPC Sans Cerveau', 'NPC Scriptless', 'NPC Fluide', 'NPC Cope Dealer',
    ];
    const newNick = npcNames[Math.floor(Math.random() * npcNames.length)];

    try {
      await target.setNickname(newNick, `NPC par ${message.author.tag}`);

      npcList[target.id] = {
        originalNick,
        until: Date.now() + NPC_DURATION_MS,
        guildId: message.guild.id,
      };
      saveNpcList();

      const npcEmbed = embed('#95A5A6')
        .setTitle('🤖 Statut NPC activé')
        .setDescription(
          `<@${target.id}> est désormais un **NPC** pour les **${dureeMin} prochaines minutes**.\n\n` +
          `Ses messages seront traités comme des *interactions scriptées sans valeur cognitive*.`
        )
        .addFields(
          { name: '🎭 Nouveau pseudo', value: newNick,                     inline: true },
          { name: '👮 Par',            value: `<@${message.author.id}>`,   inline: true },
          { name: '⏱️ Durée',         value: `${dureeMin} min`,            inline: true },
        )
        .setFooter({ text: 'NPC Mode™ — Retour à la conscience dans quelques minutes.' });

      await message.reply({ embeds: [npcEmbed] });

      await logSanction(message.guild, [
        { name: '👤 Membre',  value: `<@${target.id}>`,          inline: true },
        { name: '👮 Par',     value: `<@${message.author.id}>`,  inline: true },
        { name: '⏱️ Durée',  value: `${dureeMin} min`,           inline: true },
      ], `🤖 NPC — ${target.user.tag}`, '#95A5A6');

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete npcList[target.id]; saveNpcList(); return; }
          const saved = npcList[target.id];
          const restore = saved?.originalNick === target.user.username ? null : saved?.originalNick;
          await member.setNickname(restore, 'Fin du statut NPC');
          delete npcList[target.id];
          saveNpcList();
          console.log(`[NPC] ${target.user.tag} — statut NPC retiré.`);
        } catch (err) { console.error('[NPC] Erreur restauration pseudo :', err.message); }
      }, NPC_DURATION_MS);

    } catch (err) {
      await message.reply(`❌ Erreur : ${err.message}`);
    }
  },

  // ============================================================
  //  🔄  RESETPSEUDO
  // ============================================================

  '!resetpseudo': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!resetpseudo @user`');

    try {
      const oldNick = target.nickname || '*aucun surnom*';
      await target.setNickname(null, `Reset pseudo par ${message.author.tag}`);

      // Nettoyage des données NPC/TF si présentes
      if (npcList[target.id]) { delete npcList[target.id]; saveNpcList(); }
      if (tfList[target.id])  { delete tfList[target.id];  saveTfList();  }

      await message.reply({
        embeds: [embed('#00FF66')
          .setTitle('🔄 Pseudo réinitialisé')
          .addFields(
            { name: '👤 Membre',      value: `<@${target.id}>`,          inline: true },
            { name: '📛 Ancien pseudo', value: oldNick,                  inline: true },
            { name: '👮 Par',          value: `<@${message.author.id}>`, inline: true },
          )
        ],
      });
    } catch (err) {
      await message.reply(`❌ Erreur : ${err.message}`);
    }
  },

  // ============================================================
  //  🎭  TF (Transform / Rename troll)
  // ============================================================

  '!tf': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!tf @user`');
    if (isAdmin(target.id)) return message.reply('❌ Tu ne peux pas transformer un admin.');

    const TF_DURATION_MS = 10 * 60 * 1000;
    const dureeMin = Math.round(TF_DURATION_MS / 60000);
    const originalNick = target.nickname || target.user.username;

    const tfNames = [
      'Le Copeur Certifié',
      'M. Fluide 2024',
      'Natty Suspect #1',
      'Le Roi du Fenugrec',
      'Monsieur Maingain',
      'Le Bulk Éternel',
      'Prince du Cope',
      'IQ Test Échoué',
      'Fonte Imaginaire',
      'Background NPC',
      'Zyzz Raté',
      'Le Sourceur',
      'Hgh Anonymous',
      'Mr. Overdose Créatine',
      'Amateur de MK677',
    ];
    const newNick = tfNames[Math.floor(Math.random() * tfNames.length)];

    try {
      await target.setNickname(newNick, `TF par ${message.author.tag}`);

      tfList[target.id] = {
        originalNick,
        until: Date.now() + TF_DURATION_MS,
        guildId: message.guild.id,
      };
      saveTfList();

      const tfEmbed = embed('#9B59B6')
        .setTitle('🎭 Transformation activée')
        .setDescription(`<@${target.id}> a été transformé pour **${dureeMin} minutes**.`)
        .addFields(
          { name: '📛 Ancien pseudo',  value: originalNick,               inline: true },
          { name: '🎭 Nouveau pseudo', value: newNick,                    inline: true },
          { name: '👮 Par',            value: `<@${message.author.id}>`,  inline: true },
          { name: '⏱️ Durée',         value: `${dureeMin} min`,           inline: true },
        )
        .setFooter({ text: 'TF Mode™ — Identité temporairement confisquée.' });

      await message.reply({ embeds: [tfEmbed] });

      await logSanction(message.guild, [
        { name: '👤 Membre',          value: `<@${target.id}>`,          inline: true },
        { name: '🎭 Nouveau pseudo',  value: newNick,                    inline: true },
        { name: '👮 Par',             value: `<@${message.author.id}>`,  inline: true },
      ], `🎭 TF — ${target.user.tag}`, '#9B59B6');

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete tfList[target.id]; saveTfList(); return; }
          const saved = tfList[target.id];
          const restore = saved?.originalNick === target.user.username ? null : saved?.originalNick;
          await member.setNickname(restore, 'Fin du TF');
          delete tfList[target.id];
          saveTfList();
          console.log(`[TF] ${target.user.tag} — pseudo restauré.`);
        } catch (err) { console.error('[TF] Erreur restauration pseudo :', err.message); }
      }, TF_DURATION_MS);

    } catch (err) {
      await message.reply(`❌ Erreur : ${err.message}`);
    }
  },

  // ============================================================
  //  🎫  TICKETS
  // ============================================================

  '!ticket-setrole': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mentionne un rôle. Exemple : `!ticket-setrole @Membres`');
    ticketConfig.viewRoleId = role.id;
    saveTicketConfig();
    await message.reply(`✅ Rôle viewer des tickets défini : <@&${role.id}>`);
  },

  '!ticket-setstaff': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mentionne un rôle. Exemple : `!ticket-setstaff @Staff`');
    ticketConfig.staffRoleId = role.id;
    saveTicketConfig();
    await message.reply(`✅ Rôle staff des tickets défini : <@&${role.id}>`);
  },

  '!ticket-config': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const e = embed('#00FF66')
      .setTitle('🎫 Configuration des tickets')
      .addFields(
        { name: '👁️ Rôle viewer', value: ticketConfig.viewRoleId  ? `<@&${ticketConfig.viewRoleId}>`  : '❌ Non défini', inline: false },
        { name: '✍️ Rôle staff',  value: ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '⚠️ Non défini', inline: false },
      );
    await message.reply({ embeds: [e] });
  },

  '!ticket': async (message, args) => {
    try { await message.delete(); } catch {}
    const motif = args.join(' ').trim();
    if (!motif) {
      const errMsg = await message.channel.send('❌ Format : `!ticket <motif>`').catch(() => null);
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
      } catch { console.warn(`[TICKET] Admin ${adminId} introuvable, ignoré.`); }
    }
    try {
      const channel = await guild.channels.create({
        name: `ticket-${ticketNumber}`, type: 0,
        permissionOverwrites: overwrites,
        reason: `Ticket #${ticketNumber} ouvert par ${message.author.tag}`,
      });
      ticketsData[channel.id] = { openerId: message.author.id, openerTag: message.author.tag, ticketNumber, motif, openedAt: new Date().toISOString() };
      saveTickets();
      const staffMention = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '';
      const ticketEmbed = embed('#00FF66')
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription('Le staff va traiter ta demande sous 24h.\n\n> Pour fermer ce ticket, utilise `!fermer`')
        .addFields({ name: '🧾 Ouvert par', value: `<@${message.author.id}>`, inline: true }, { name: '📌 Motif', value: motif, inline: false })
        .setFooter({ text: `Ticket #${ticketNumber}` });
      await channel.send({ content: `<@${message.author.id}>${staffMention ? ` ${staffMention}` : ''}`, embeds: [ticketEmbed] });
      const confirmMsg = await message.channel.send(`✅ Ton ticket a été créé : ${channel}`).catch(() => null);
      if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => {}), 6000);
    } catch (error) {
      console.error('Erreur création ticket:', error);
      const errMsg = await message.channel.send(`❌ Impossible de créer le ticket : ${error.message}`).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
    }
  },

  '!fermer': async (message) => {
    try { await message.delete(); } catch {}
    const channelId  = message.channel.id;
    const ticketInfo = ticketsData[channelId];
    if (!ticketInfo) {
      const errMsg = await message.channel.send('❌ Cette commande ne peut être utilisée que dans un salon ticket.').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }
    const canClose = isAdmin(message.author.id) || message.author.id === ticketInfo.openerId;
    if (!canClose) {
      const errMsg = await message.channel.send('❌ Seul le staff ou la personne qui a ouvert ce ticket peut le fermer.').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }
    const closeEmbed = embed('#FF4444')
      .setTitle('🔒 Ticket fermé')
      .setDescription(`Ce ticket a été fermé par <@${message.author.id}>.\n\nLe salon sera supprimé dans **5 secondes**.`)
      .addFields({ name: '🧾 Ouvert par', value: `<@${ticketInfo.openerId}>`, inline: true }, { name: '📌 Motif', value: ticketInfo.motif, inline: false })
      .setFooter({ text: `Ticket #${ticketInfo.ticketNumber}` });
    await message.channel.send({ embeds: [closeEmbed] }).catch(() => {});
    delete ticketsData[channelId];
    saveTickets();
    setTimeout(async () => {
      try { await message.channel.delete(`Ticket fermé par ${message.author.tag}`); }
      catch (err) { console.error('[FERMER] Erreur suppression salon :', err.message); }
    }, 5000);
  },

  // ============================================================
  //  🎭  MULTI-REACTION ROLES
  // ============================================================

  '!rr-setup': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!rr-setup <#channel> | <titre> | <description (optionnelle)>`');
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) return message.reply('❌ Mentionne un channel valide.');
    const titre       = parts[1];
    const description = parts[2] || 'Réagis avec les emojis ci-dessous pour obtenir tes rôles !';
    const rrEmbed = embed('#7289DA')
      .setTitle(`🎭 ${titre}`).setDescription(description)
      .addFields({ name: '📋 Rôles disponibles', value: '*Aucun rôle configuré pour l\'instant.*', inline: false })
      .setFooter({ text: 'Réagis pour obtenir un rôle • Retire ta réaction pour le perdre' });
    const sent = await targetChannel.send({ embeds: [rrEmbed] });
    reactionRolesData[sent.id] = { channelId: targetChannel.id, titre, description, roles: {}, existingMessage: false };
    saveReactionRoles();
    await message.reply(`✅ Message de reaction role créé dans ${targetChannel} !\n📋 ID : \`${sent.id}\``);
  },

  '!rr-attach': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!rr-attach <messageID> <#channel> | <titre> | <description optionnelle>`');
    const firstPartTokens = parts[0].split(/\s+/);
    if (firstPartTokens.length < 2) return message.reply('❌ Tu dois fournir le **messageID** ET mentionner le **#channel**.');
    const messageId     = firstPartTokens[0];
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) return message.reply('❌ Mentionne le salon où se trouve le message.');
    const titre       = parts[1] || 'Reaction Roles';
    const description = parts[2] || 'Réagis pour obtenir un rôle !';
    let targetMessage;
    try { targetMessage = await targetChannel.messages.fetch(messageId); }
    catch { return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\` dans ${targetChannel}.`); }
    if (reactionRolesData[messageId]) return message.reply(`⚠️ Ce message est déjà enregistré comme reaction role.`);
    reactionRolesData[messageId] = { channelId: targetChannel.id, titre, description, roles: {}, existingMessage: true };
    saveReactionRoles();
    await message.reply(`✅ Message \`${messageId}\` enregistré comme reaction role dans ${targetChannel} !`);
  },

  '!rr-add': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) return message.reply('❌ Format : `!rr-add <messageID> | <emoji> | <@role>`');
    const messageId = parts[0];
    const emoji     = parts[1];
    const role      = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mentionne un rôle valide.');
    if (!reactionRolesData[messageId]) return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\`.`);
    const rrEntry = reactionRolesData[messageId];
    if (rrEntry.roles[emoji]) return message.reply(`⚠️ L'emoji ${emoji} est déjà utilisé.`);
    try {
      const targetChannel = await client.channels.fetch(rrEntry.channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      await targetMessage.react(emoji);
      rrEntry.roles[emoji] = role.id;
      saveReactionRoles();
      if (!rrEntry.existingMessage) await updateRREmbed(targetMessage, rrEntry);
      await message.reply(`✅ ${emoji} → <@&${role.id}> ajouté !`);
    } catch (err) { await message.reply(`❌ Erreur : ${err.message}`); }
  },

  '!rr-remove': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!rr-remove <messageID> | <emoji>`');
    const [messageId, emoji] = parts;
    if (!reactionRolesData[messageId]) return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\`.`);
    if (!reactionRolesData[messageId].roles[emoji]) return message.reply(`❌ L'emoji ${emoji} n'est pas configuré.`);
    try {
      const targetChannel = await client.channels.fetch(reactionRolesData[messageId].channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji);
      if (reaction) await reaction.remove();
      delete reactionRolesData[messageId].roles[emoji];
      saveReactionRoles();
      if (!reactionRolesData[messageId].existingMessage) await updateRREmbed(targetMessage, reactionRolesData[messageId]);
      await message.reply(`✅ Emoji ${emoji} retiré.`);
    } catch (err) { await message.reply(`❌ Erreur : ${err.message}`); }
  },

  '!rr-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const entries = Object.entries(reactionRolesData);
    if (entries.length === 0) return message.reply('ℹ️ Aucun message de reaction role configuré.');
    const fields = entries.map(([msgId, data]) => ({
      name: `${data.existingMessage ? '📎' : '🆕'} "${data.titre}" — \`${msgId}\``,
      value: [`Salon : <#${data.channelId}>`, Object.entries(data.roles).map(([e, r]) => `${e} → <@&${r}>`).join('\n') || '*Aucun rôle*'].join('\n'),
      inline: false,
    }));
    await message.reply({ embeds: [embed('#7289DA').setTitle('🎭 Reaction Roles configurés').addFields(fields)] });
  },

  '!rr-delete': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const messageId = args[0];
    if (!messageId) return message.reply('❌ Format : `!rr-delete <messageID>`');
    if (!reactionRolesData[messageId]) return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\`.`);
    const rrEntry = reactionRolesData[messageId];
    try {
      const targetChannel = await client.channels.fetch(rrEntry.channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      if (rrEntry.existingMessage) {
        for (const emoji of Object.keys(rrEntry.roles)) {
          try { const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji); if (reaction) await reaction.users.remove(client.user.id); } catch {}
        }
      } else { await targetMessage.delete(); }
    } catch { console.warn('[RR-DELETE] Message introuvable ou déjà supprimé.'); }
    delete reactionRolesData[messageId];
    saveReactionRoles();
    await message.reply(rrEntry.existingMessage ? `✅ Config RR retirée du message \`${messageId}\` (message original conservé).` : `✅ Message RR \`${messageId}\` supprimé.`);
  },

  // ============================================================
  //  🔬  ÉTUDES / PUBMED
  // ============================================================

  '!pubmed': async (message) => {
    const fields = [{ name: '📄 Titre', value: studyData.title || 'Non défini', inline: false }];
    if (studyData.url)   fields.push({ name: '🔗 Lien',        value: studyData.url,              inline: false });
    if (studyData.setBy) fields.push({ name: '👤 Définie par', value: `<@${studyData.setBy}>`,    inline: true  });
    if (studyData.setAt) fields.push({ name: '📅 Date',        value: studyData.setAt,            inline: true  });
    await message.reply({ embeds: [embed('#00B5D8').setTitle('🔬 Dernière étude partagée').setDescription(studyData.description || 'Aucune description.').addFields(fields)] });
  },

  '!def-etude': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!def-etude <titre> | <url> | <description>`');
    studyData = { title: parts[0] || 'Sans titre', url: parts[1] || '', description: parts[2] || '', setBy: message.author.id, setAt: new Date().toLocaleDateString('fr-FR') };
    saveJSON(FILES.study, studyData);
    await message.reply(`✅ Étude mise à jour : **${studyData.title}**`);
  },

  // ============================================================
  //  💊  COPE / INTÉRESSANT
  // ============================================================

  '!cope': async (message) => {
    const copeList        = copesData.cope.length        > 0 ? copesData.cope.map((c, i)        => `${i + 1}. ${c}`).join('\n') : '*Aucun complément.*';
    const interestingList = copesData.interesting.length > 0 ? copesData.interesting.map((c, i) => `${i + 1}. ${c}`).join('\n') : '*Aucun complément.*';
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('💊 Liste des compléments').addFields(
      { name: '❌ COPE (Inutiles)',   value: copeList.slice(0, 1024),        inline: false },
      { name: '✅ Intéressants',       value: interestingList.slice(0, 1024), inline: false },
    ).setFooter({ text: `${copesData.cope.length} cope(s) | ${copesData.interesting.length} intéressant(s)` })] });
  },

  '!add-cope': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('❌ Format : `!add-cope <nom>`');
    if (copesData.cope.includes(name)) return message.reply('⚠️ Déjà dans la liste Cope.');
    copesData.cope.push(name); saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** ajouté à la liste Cope.`);
  },

  '!add-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('❌ Format : `!add-interesting <nom>`');
    if (copesData.interesting.includes(name)) return message.reply('⚠️ Déjà dans la liste Intéressants.');
    copesData.interesting.push(name); saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** ajouté à la liste Intéressants.`);
  },

  '!remove-cope': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    const idx  = copesData.cope.indexOf(name);
    if (idx === -1) return message.reply(`❌ **${name}** introuvable dans Cope.`);
    copesData.cope.splice(idx, 1); saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** retiré de la liste Cope.`);
  },

  '!remove-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    const idx  = copesData.interesting.indexOf(name);
    if (idx === -1) return message.reply(`❌ **${name}** introuvable dans Intéressants.`);
    copesData.interesting.splice(idx, 1); saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** retiré de la liste Intéressants.`);
  },

  // ============================================================
  //  📜  RÈGLES
  // ============================================================

  '!regles': async (message) => {
    const rulesList = Object.entries(rulesData).sort(([a], [b]) => Number(a) - Number(b)).map(([n, text]) => `**${n}.** ${text}`).join('\n');
    await message.reply({ embeds: [embed('#FAD961').setTitle('📜 Règles du serveur').setDescription(rulesList || '*Aucune règle définie.*')] });
  },

  '!set-regle': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2 || isNaN(Number(parts[0]))) return message.reply('❌ Format : `!set-regle <numéro> | <texte>`');
    rulesData[parts[0]] = parts[1]; saveJSON(FILES.rules, rulesData);
    await message.reply(`✅ Règle **${parts[0]}** mise à jour.`);
  },

  // ============================================================
  //  🔨  MODÉRATION
  // ============================================================

  '!source': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !source — CF : règle 1.');
      await message.reply({ embeds: [embed('#FFA500').setTitle('🔇 Mute automatique').setDescription(`<@${message.author.id}> a été muté pendant 10 minutes.\n\n**CF : règle 1.**`)] });
    } catch (err) { await message.reply(`❌ Impossible de muter : ${err.message}`); }
  },

  '!mk677': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !mk677 — CF : règle 1.');
      await message.reply({ embeds: [embed('#FF4444').setTitle('🔇 Mute automatique (mk677)').setDescription(`<@${message.author.id}> a été muté pendant 10 minutes.\n\n**CF : règle 1.**`)] });
    } catch (err) { await message.reply(`❌ Impossible de muter : ${err.message}`); }
  },

  '!ban': async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Tu n\'as pas la permission de bannir des membres.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur à bannir : `!ban @user [raison]`');
    if (!target.bannable) return message.reply('❌ Je ne peux pas bannir cet utilisateur.');
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try {
      await target.ban({ reason: `${message.author.tag}: ${reason}`, deleteMessageSeconds: 604800 });
      await message.reply({ embeds: [embed('#FF4444').setTitle('🔨 Utilisateur banni').addFields(
        { name: 'Utilisateur', value: target.user.tag,    inline: true },
        { name: 'Par',         value: message.author.tag, inline: true },
        { name: 'Raison',      value: reason,             inline: false },
      )] });
      await logSanction(message.guild, [
        { name: '👤 Membre',  value: target.user.tag,          inline: true },
        { name: '👮 Par',     value: `<@${message.author.id}>`, inline: true },
        { name: '📌 Raison',  value: reason,                   inline: false },
      ], `🔨 Ban — ${target.user.tag}`, '#FF0000');
    } catch (err) { await message.reply(`❌ Erreur lors du ban : ${err.message}`); }
  },

  // ============================================================
  //  🔒  JAIL
  // ============================================================

  '!jail': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!jail @user`');
    if (isAdmin(target.id)) return message.reply('❌ Tu ne peux pas emprisonner un admin.');

    const accessRole    = message.guild.roles.cache.get(CONFIG.JAIL_ACCESS_ROLE_ID);
    if (!accessRole)    return message.reply('❌ Rôle d\'accès introuvable (vérifie JAIL_ACCESS_ROLE_ID).');
    const prisonChannel = message.guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
    const prisonMention = prisonChannel ? `<#${CONFIG.JAIL_PRISON_CHANNEL_ID}>` : '#prison';
    const hadRole       = target.roles.cache.has(CONFIG.JAIL_ACCESS_ROLE_ID);
    const dureeMin      = Math.round(CONFIG.JAIL_DURATION_MS / 60000);

    try {
      if (hadRole) await target.roles.remove(accessRole, `Jail par ${message.author.tag}`);

      jailsData[target.id] = { until: Date.now() + CONFIG.JAIL_DURATION_MS, hadRole, guildId: message.guild.id };
      saveJails();

      const jailEmbed = embed('#FF4444')
        .setTitle('⛓️ Emprisonné !')
        .setDescription(`<@${target.id}> a été envoyé en prison par <@${message.author.id}>.\nAccès au serveur retiré. Seul ${prisonMention} reste visible.\n\n**Libération automatique dans ${dureeMin} minute${dureeMin > 1 ? 's' : ''}.**`)
        .addFields({ name: '👮 Par', value: `<@${message.author.id}>`, inline: true }, { name: '⏱️ Durée', value: `${dureeMin} min`, inline: true })
        .setFooter({ text: 'Réfléchis à tes actes.' });
      await message.reply({ embeds: [jailEmbed] });

      if (prisonChannel) {
        await prisonChannel.send({ content: `<@${target.id}>`, embeds: [embed('#FF4444').setTitle('🔒 Tu es en prison').setDescription(`Tu as été emprisonné par <@${message.author.id}>.\nTu seras libéré dans **${dureeMin} minute${dureeMin > 1 ? 's' : ''}**.`)] });
      }

      await logSanction(message.guild, [
        { name: '👤 Membre',  value: `<@${target.id}>`,          inline: true },
        { name: '👮 Par',     value: `<@${message.author.id}>`,  inline: true },
        { name: '⏱️ Durée',  value: `${dureeMin} min`,           inline: true },
      ], `⛓️ Jail — ${target.user.tag}`, '#FF4444');

      console.log(`[JAIL] ${target.user.tag} emprisonné par ${message.author.tag} (${dureeMin} min)`);

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete jailsData[target.id]; saveJails(); return; }
          if (hadRole && !member.roles.cache.has(CONFIG.JAIL_ACCESS_ROLE_ID)) {
            await member.roles.add(accessRole, 'Libération automatique après jail');
          }
          delete jailsData[target.id];
          saveJails();
          if (prisonChannel) {
            await prisonChannel.send({ embeds: [embed('#00FF66').setTitle('🔓 Libéré !').setDescription(`<@${target.id}> a purgé sa peine et retrouve l'accès au serveur.`)] });
          }
          console.log(`[JAIL] ${target.user.tag} libéré automatiquement.`);
        } catch (err) { console.error('[JAIL] Erreur libération :', err.message); }
      }, CONFIG.JAIL_DURATION_MS);

    } catch (err) { await message.reply(`❌ Erreur : ${err.message}`); }
  },

  // ============================================================
  //  🧠  IQTEST
  // ============================================================

  '!iqtest': async (message) => {
    const target  = message.mentions.members.first() || message.member;
    const base    = isAdmin(message.author.id) ? 110 : 90;
    const iq      = Math.floor(base + (Math.random() * 80) - 40);
    let verdict, color;
    if      (iq >= 145) { verdict = '🧬 Génie absolu. Probablement un mensonge.';                  color = '#7289DA'; }
    else if (iq >= 120) { verdict = '📚 Intelligent. Tu poses quand même des questions idiotes.';   color = '#00B5D8'; }
    else if (iq >= 100) { verdict = '😐 Dans la moyenne. C\'est pas glorieux.';                    color = '#FAD961'; }
    else if (iq >= 80)  { verdict = '🥴 En dessous de la moyenne. Ça explique beaucoup.';          color = '#FFA500'; }
    else if (iq >= 60)  { verdict = '💀 Cliniquement préoccupant. Consulte.';                      color = '#FF4444'; }
    else                { verdict = '🪨 Roche. Tu es une roche.';                                  color = '#FF0000'; }
    await message.reply({ embeds: [embed(color).setTitle(`🧠 Résultat IQ — ${target.displayName}`).addFields(
      { name: 'Score officiel', value: `**${iq} points**`,                              inline: true  },
      { name: 'Percentile',     value: `Top ${Math.max(1, 100 - Math.floor(iq / 2))}%`, inline: true  },
      { name: 'Verdict',        value: verdict,                                          inline: false },
    ).setFooter({ text: 'Certifié par l\'Institut International du Cerveau Fluide™' })] });
  },

  // ============================================================
  //  💊  COPE DU JOUR
  // ============================================================

  '!cope-du-jour': async (message) => {
    if (copesData.cope.length === 0) return message.reply('❌ Aucun cope dans la liste. Utilise `!add-cope` pour en ajouter.');
    const random = copesData.cope[Math.floor(Math.random() * copesData.cope.length)];
    const refutations = [
      'Aucune étude peer-reviewed ne supporte cette affirmation.',
      'Des scientifiques ont tenté de reproduire ces résultats. Ils pleurent encore.',
      'Efficacité prouvée sur 3 personnes dont 2 qui voulaient récupérer leur argent.',
      'Le seul effet documenté : appauvrissement du portefeuille.',
      'Meta-analyse de 0 études conclut à l\'absence totale d\'effet.',
      'Recommandé par des influenceurs fitness. C\'est tout ce qu\'on dira.',
      'La FDA, l\'EFSA et ton médecin généraliste ont ri en chœur.',
      'Fonctionne très bien sur des souris. Toi, tu n\'es pas une souris.',
      'Approuvé par des gens qui vendent aussi des colliers magnétiques.',
      'L\'étude citée : un blog wordpress de 2011 sans sources.',
    ];
    const refutation = refutations[Math.floor(Math.random() * refutations.length)];
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('💊 Cope du jour').addFields(
      { name: '🎯 Produit du jour',    value: `**${random}**`, inline: false },
      { name: '🔬 Avis scientifique',  value: refutation,      inline: false },
    ).setFooter({ text: 'Basé sur des données solides. Très solides. Bétonnées.' })] });
  },

  // ============================================================
  //  🌊  FLUIDE
  // ============================================================

  '!fluide': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur : `!fluide @user`');
    const motifs = [
      'comportement inexplicable détecté', 'neurones dysfonctionnels confirmés',
      'cohérence logique introuvable', 'ratio subi sans broncher',
      'a défendu un cope en public', 'a demandé une source',
      'a mentionné le MK-677 volontairement', 'analyse biométrique : QI fluide détecté',
      'a pris du fenugrec en pensant que ça servait à quelque chose',
      'a confondu créatine et stéroïdes pour la 3ème fois',
    ];
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    await message.reply({ embeds: [embed('#9B59B6')
      .setTitle('🌊 Système Fluide Activé')
      .setDescription(`<@${target.id}> est officiellement passé sous **système fluide** pour les prochaines **24h**.\n\nConformément à la règle 3, les insultes et ratios à son encontre sont désormais **autorisés et encouragés**.`)
      .addFields(
        { name: '📋 Motif détecté', value: motif,                                   inline: false },
        { name: '⚠️ Statut',        value: 'FLUIDE — Protection sociale retirée',   inline: true  },
        { name: '⏱️ Durée estimée', value: '24h (ou jusqu\'à guérison)',            inline: true  },
      )
      .setFooter({ text: `Décision prise par ${message.author.displayName} • Système Fluide™` })
    ] });
  },

  // ============================================================
  //  🎵  MOMMY ASMR
  // ============================================================

  '!mommy-asmr': async (message) => {
    if (!CONFIG.MOMMY_ASMR_USER_IDS.includes(message.author.id)) return message.reply('❌ Permission refusée.');
    try {
      await message.channel.send({ content: '🎧 Mommy ASMR en approche...', files: [CONFIG.MOMMY_ASMR_FILE_URL] });
    } catch (err) { await message.reply(`❌ Échec envoi ASMR : ${err.message}`); }
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

  const ruleMatch = cmd.match(/^!regle(\d+)$/);
  if (ruleMatch) {
    const num = ruleMatch[1];
    if (rulesData[num]) {
      await message.reply({ embeds: [embed('#FAD961').setTitle(`📜 Règle ${num}`).setDescription(rulesData[num])] });
    } else {
      await message.reply(`❌ La règle **${num}** n'existe pas. Utilise \`!regles\` pour voir toutes les règles.`);
    }
  }
});

// ============================================================
//  🎭  REACTION ROLES
// ============================================================

client.on('messageReactionAdd', async (reaction, user) => {
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
      if (!role) return console.error('[REACTION ROLE] Rôle introuvable :', ROLE_ID);
      await member.roles.add(role);
      console.log(`[REACTION ROLE] Rôle "${role.name}" donné à ${user.tag}`);
      try { await user.send('✅ Tu as bien reçu l\'accès au serveur ! Bienvenue 🎉'); } catch {}
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
      await member.roles.add(role);
    } catch (err) { console.error('[MULTI-RR] Erreur ajout rôle :', err.message); }
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
    } catch (err) { console.error('[MULTI-RR] Erreur retrait rôle :', err.message); }
  }
});

// ============================================================
//  📺  TIKTOK LIVE CHECKER
// ============================================================

async function checkTikTokLive() {
  try {
    const response = await axios.get(`https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, {
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
      liveStatus.isLive       = true;
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
    if (err.response?.status === 429) console.warn('[LIVE] Rate limit TikTok.');
    else console.error('[LIVE] Erreur vérification TikTok:', err.message);
  }
}

// ============================================================
//  ♻️  RESTAURATION DES TIMERS AU DÉMARRAGE (NPC / TF / JAIL)
// ============================================================

async function restoreTimers() {
  const now = Date.now();

  // — Jails —
  for (const [userId, data] of Object.entries(jailsData)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      // Jail expiré pendant l'arrêt : libérer immédiatement
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        if (!guild) { delete jailsData[userId]; continue; }
        const member = await guild.members.fetch(userId).catch(() => null);
        const accessRole = guild.roles.cache.get(CONFIG.JAIL_ACCESS_ROLE_ID);
        if (member && data.hadRole && accessRole && !member.roles.cache.has(CONFIG.JAIL_ACCESS_ROLE_ID)) {
          await member.roles.add(accessRole, 'Libération automatique (rattrapage démarrage)');
        }
      } catch (err) { console.error('[RESTORE JAIL] Erreur :', err.message); }
      delete jailsData[userId];
    } else {
      console.log(`[RESTORE] Jail restauré pour ${userId} — ${Math.ceil(remaining / 1000 / 60)} min restantes`);
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          if (!guild) { delete jailsData[userId]; saveJails(); return; }
          const member = await guild.members.fetch(userId).catch(() => null);
          const accessRole = guild.roles.cache.get(CONFIG.JAIL_ACCESS_ROLE_ID);
          if (member && data.hadRole && accessRole && !member.roles.cache.has(CONFIG.JAIL_ACCESS_ROLE_ID)) {
            await member.roles.add(accessRole, 'Libération automatique après jail');
          }
          delete jailsData[userId]; saveJails();
          console.log(`[RESTORE JAIL] ${userId} libéré.`);
        } catch (err) { console.error('[RESTORE JAIL] Erreur libération :', err.message); }
      }, remaining);
    }
  }
  saveJails();

  // — NPC —
  for (const [userId, data] of Object.entries(npcList)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        const restore = data.originalNick === member?.user?.username ? null : data.originalNick;
        if (member) await member.setNickname(restore, 'Fin NPC (rattrapage démarrage)');
      } catch {}
      delete npcList[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
          const restore = data.originalNick === member?.user?.username ? null : data.originalNick;
          if (member) await member.setNickname(restore, 'Fin du statut NPC');
          delete npcList[userId]; saveNpcList();
        } catch {}
      }, remaining);
    }
  }
  saveNpcList();

  // — TF —
  for (const [userId, data] of Object.entries(tfList)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        const restore = data.originalNick === member?.user?.username ? null : data.originalNick;
        if (member) await member.setNickname(restore, 'Fin TF (rattrapage démarrage)');
      } catch {}
      delete tfList[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
          const restore = data.originalNick === member?.user?.username ? null : data.originalNick;
          if (member) await member.setNickname(restore, 'Fin du TF');
          delete tfList[userId]; saveTfList();
        } catch {}
      }, remaining);
    }
  }
  saveTfList();

  console.log('[RESTORE] Timers restaurés avec succès.');
}

// ============================================================
//  🚀  DÉMARRAGE
// ============================================================

client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`👑 Admins: ${CONFIG.ADMIN_IDS.join(', ')}`);
  console.log(`📺 Surveillance TikTok: @${CONFIG.TIKTOK_USERNAME}`);
  console.log(`📢 Channel live: ${CONFIG.LIVE_CHANNEL_ID}`);
  console.log(`🎭 Multi-RR chargés: ${Object.keys(reactionRolesData).length} message(s)`);
  console.log(`🎫 Ticket viewer role: ${ticketConfig.viewRoleId  || 'non défini'}`);
  console.log(`🎫 Ticket staff role:  ${ticketConfig.staffRoleId || 'non défini'}`);
  console.log(`🎫 Tickets actifs: ${Object.keys(ticketsData).length}`);
  console.log(`🔒 Jail access role: ${CONFIG.JAIL_ACCESS_ROLE_ID}`);
  console.log(`🔒 Jail prison channel: ${CONFIG.JAIL_PRISON_CHANNEL_ID}`);
  console.log(`📋 Sanction log channel: ${sanctionLogData.channelId || 'non défini'}`);
  console.log(`⚠️  Warns chargés: ${Object.keys(warnsData).length} membre(s)`);
  console.log(`⛓️  Jails actifs: ${Object.keys(jailsData).length}`);

  await restoreTimers();

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
