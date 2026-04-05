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
    ROLE_ID:    '1487674672865611806',
    EMOJI:      '\u2705',
  },

  JAIL_ACCESS_ROLE_ID: '1487674672865611806',
  JAIL_PRISON_CHANNEL_ID: '1489385660979872005',
  JAIL_DURATION_MS: 5 * 60 * 1000,
  JAIL_PROTECTED_ROLE_IDS: [],
};

// ============================================================
//  CHEMINS DES FICHIERS DE DONNEES
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
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ============================================================
//  HELPERS JSON
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
//  DONNEES
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
function saveTournaments()    { saveJSON(FILES.tournaments,   tournamentsData); }

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

function isAdmin(userId) { return CONFIG.ADMIN_IDS.includes(userId); }
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
//  HELPER -- Met a jour l'embed du message RR
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
  if (removedRoleIds.length > 0) {
    await member.roles.remove(rolesToRemove, reason);
  }

  const channelPromises = guild.channels.cache
    .filter(ch =>
      ch.id !== CONFIG.JAIL_PRISON_CHANNEL_ID &&
      (ch.isTextBased() || ch.isVoiceBased())
    )
    .map(ch =>
      ch.permissionOverwrites.edit(member.id, {
        ViewChannel:  false,
        SendMessages: false,
        Connect:      false,
      }, { reason }).catch(err =>
        console.warn(`[JAIL] Impossible de modifier #${ch.name} : ${err.message}`)
      )
    );
  await Promise.all(channelPromises);

  const prisonChannel = guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
  if (prisonChannel) {
    await prisonChannel.permissionOverwrites.edit(member.id, {
      ViewChannel:        true,
      SendMessages:       true,
      ReadMessageHistory: true,
    }, { reason }).catch(err =>
      console.warn(`[JAIL] Impossible de modifier le salon prison : ${err.message}`)
    );
  }

  console.log(`[JAIL] ${member.user.tag} verrouille -- ${removedRoleIds.length} roles retires, acces restreint au salon prison.`);
  return removedRoleIds;
}

async function unjailMember(member, savedRoleIds, reason) {
  const guild = member.guild;

  const channelPromises = guild.channels.cache
    .filter(ch => ch.isTextBased() || ch.isVoiceBased())
    .map(ch =>
      ch.permissionOverwrites.delete(member.id, reason).catch(() => {})
    );
  await Promise.all(channelPromises);

  const rolesToAdd = savedRoleIds
    .map(id => guild.roles.cache.get(id))
    .filter(Boolean)
    .filter(role => !member.roles.cache.has(role.id));
  if (rolesToAdd.length > 0) {
    await member.roles.add(rolesToAdd, reason);
  }

  console.log(`[JAIL] ${member.user.tag} libere -- overwrites supprimes, ${rolesToAdd.length} role(s) restaure(s).`);
}

// ============================================================
//  TOURNOI -- HELPERS
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
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  if (shuffled.length % 2 !== 0) {
    pairs.push([shuffled[shuffled.length - 1], null]);
  }
  return pairs;
}

async function sendVersus(channel, tournamentId, matchIndex, p1, p2) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tournament_${tournamentId}_${matchIndex}_A`)
      .setLabel('\uD83C\uDFC6 Joueur A')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`tournament_${tournamentId}_${matchIndex}_B`)
      .setLabel('\uD83C\uDFC6 Joueur B')
      .setStyle(ButtonStyle.Danger),
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

  await channel.send({
    content: `**Match ${matchIndex + 1}** -- \uD83C\uDD70\uFE0F **${p1.username}** vs \uD83C\uDD71\uFE0F **${p2.username}**`,
  });

  await channel.send({
    content: `\uD83C\uDD70\uFE0F **${p1.username}**`,
    files: [p1.imageUrl],
  }).catch(async () => {
    return channel.send({ content: `\uD83C\uDD70\uFE0F **${p1.username}** -- (image : ${p1.imageUrl})` });
  });

  await channel.send({
    content: `\uD83C\uDD71\uFE0F **${p2.username}**`,
    files: [p2.imageUrl],
  }).catch(async () => {
    return channel.send({ content: `\uD83C\uDD71\uFE0F **${p2.username}** -- (image : ${p2.imageUrl})` });
  });

  const voteMsg = await channel.send({ embeds: [versusEmbed], components: [row] });
  return voteMsg.id;
}

// ============================================================
//  COMMANDES
// ============================================================

const commands = {

  // AIDE
  '!aide': async (message) => {
    const viewRoleDisplay   = ticketConfig.viewRoleId  ? `<@&${ticketConfig.viewRoleId}>`  : '`non defini`';
    const staffRoleDisplay  = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '`non defini`';
    const logChannelDisplay = sanctionLogData.channelId ? `<#${sanctionLogData.channelId}>` : '`non defini`';

    const e1 = embed('#5865F2')
      .setTitle('Aide -- Commandes generales')
      .setDescription('Prefixe : `!` -- Les commandes marquees sont reservees aux admins.')
      .addFields(
        {
          name: 'Etudes & Supplements',
          value: [
            '`!pubmed` -- Affiche la derniere etude enregistree',
            '`!def-etude <titre> | <url> | <desc>` -- Definit une nouvelle etude',
            '`!cope` -- Liste complete des complements (cope / interessants)',
            '`!cope-du-jour` -- Tire un cope aleatoire avec refutation scientifique',
            '`!add-cope <nom>` / `!remove-cope <nom>`',
            '`!add-interesting <nom>` / `!remove-interesting <nom>`',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Regles',
          value: [
            '`!regles` -- Affiche toutes les regles',
            '`!regle<N>` -- Affiche la regle numero N (ex: `!regle3`)',
            '`!set-regle <N> | <texte>` -- Modifie une regle',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Annonces',
          value: '`!say <#channel> | <titre> | <desc> | [couleur] | [image] | [footer]`',
          inline: false,
        },
        {
          name: 'Live TikTok',
          value: 'Detection automatique des lives -- aucune commande requise.',
          inline: false,
        },
        {
          name: 'ASMR',
          value: '`!mommy-asmr` -- *Acces restreint aux IDs autorises*',
          inline: false,
        },
        {
          name: 'Fun & Troll',
          value: [
            '`!iqtest [@user]` -- Test de QI certifie fluide',
            '`!fluide @user` -- Place un membre sous systeme fluide',
            '`!tf @user` -- Renomme trollement un membre 10 min',
            '`!npc @user` -- Declare un membre NPC pour 10 min',
            '`!resetpseudo @user` -- Reinitialise le surnom d\'un membre',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Tournoi physique',
          value: [
            '`!tournoi-start <#channel-photos>` -- Lance un tournoi avec toutes les photos du salon',
            '`!tournoi-status` -- Affiche l\'etat du tournoi en cours',
            '`!tournoi-cancel` -- Annule le tournoi en cours',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Utilitaires',
          value: '`!clear <nombre>` -- Supprime N messages dans le salon (max 100)',
          inline: false,
        },
      )
      .setFooter({ text: 'Page 1 / 3 -- Tape !aide2 pour la moderation, !aide3 pour tickets & RR' });

    const e2 = embed('#FF4444')
      .setTitle('Aide -- Moderation')
      .setDescription('Toutes les commandes de cette page sont reservees aux admins sauf mention contraire.')
      .addFields(
        {
          name: 'Systeme de warns',
          value: [
            '`!warn @user [raison]` -- Avertit un membre (auto-jail au 3eme warn)',
            '`!warns @user` -- Affiche l\'historique des warns d\'un membre',
            '`!clearwarns @user` -- Supprime tous les warns d\'un membre',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Jail',
          value: [
            '`!jail @user` -- Emprisonne un membre (retire TOUS ses roles + bloque tous les salons pendant 5 min)',
            '`!expiredjails` -- Liste les jails actifs avec temps restant',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Mutes automatiques',
          value: [
            '`!source` -- Auto-mute 10 min si utilise par un non-admin (regle 1)',
            '`!mk677` -- Auto-mute 10 min si utilise par un non-admin (regle 1)',
            '`!ban @user [raison]` -- Bannit definitivement un membre',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Logs de sanctions',
          value: [
            '`!sanction-log <#channel>` -- Definit le salon de logs',
            `Salon actuel : ${logChannelDisplay}`,
            '_Toutes les sanctions (warn, jail, ban) y sont automatiquement enregistrees._',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Page 2 / 3 -- Tape !aide pour les commandes generales, !aide3 pour tickets & RR' });

    const e3 = embed('#7289DA')
      .setTitle('Aide -- Tickets & Reaction Roles')
      .addFields(
        {
          name: 'Tickets',
          value: [
            '`!ticket <motif>` -- Ouvre un ticket prive',
            '`!fermer` -- Ferme le ticket (depuis le salon ticket)',
            '`!ticket-setrole @role` -- Role qui voit les tickets (lecture seule)',
            '`!ticket-setstaff @role` -- Role qui peut ecrire dans les tickets',
            '`!ticket-config` -- Affiche la configuration actuelle',
            `Viewer : ${viewRoleDisplay} | Staff : ${staffRoleDisplay}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Reaction Roles',
          value: [
            '`!rr-setup <#channel> | <titre> | <desc>` -- Cree un message RR',
            '`!rr-attach <msgID> <#channel> | <titre> | <desc>` -- Attache a un message existant',
            '`!rr-add <msgID> | <emoji> | <@role>` -- Ajoute un emoji/role',
            '`!rr-remove <msgID> | <emoji>` -- Retire un emoji/role',
            '`!rr-list` -- Liste tous les messages RR configures',
            '`!rr-delete <msgID>` -- Supprime un message RR',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Page 3 / 3 -- Tape !aide pour les commandes generales, !aide2 pour la moderation' });

    await message.reply({ embeds: [e1] });
    await message.channel.send({ embeds: [e2] });
    await message.channel.send({ embeds: [e3] });
  },

  '!aide2': async (message) => { await commands['!aide'](message); },
  '!aide3': async (message) => { await commands['!aide'](message); },

  // CLEAR
  '!clear': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('Specifie un nombre entre 1 et 100. Ex : `!clear 10`');
    }
    try {
      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(amount, true);
      const confirm = await message.channel.send({
        embeds: [embed('#00FF66')
          .setTitle('Messages supprimes')
          .setDescription(`**${deleted.size}** message(s) supprime(s) par <@${message.author.id}>.`)
          .setFooter({ text: 'Ce message disparait dans 5 secondes.' })
        ],
      });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
    } catch (err) {
      const errMsg = await message.channel.send(`Erreur lors de la suppression : ${err.message}`).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
    }
  },

  // SAY
  '!say': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    try { await message.delete(); } catch {}
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) {
      try {
        const errMsg = await message.channel.send('Format : `!say <#channel> | <titre> | <description> | [couleur] | [image_url] | [footer]`');
        setTimeout(() => errMsg.delete().catch(() => {}), 8000);
      } catch {}
      return;
    }
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) {
      try {
        const errMsg = await message.channel.send('Mentionne un salon valide en premier parametre.');
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
        const errMsg = await message.channel.send(`Impossible d'envoyer dans ce salon : ${err.message}`);
        setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      } catch {}
    }
  },

  // WARNS
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
        { name: 'Raison',    value: reason,                      inline: false },
        { name: 'Par',       value: `<@${message.author.id}>`,   inline: true  },
        { name: 'Total',     value: `${warnCount} warn(s)`,      inline: true  },
      )
      .setFooter({ text: warnCount >= 3 ? '3 warns atteints -- Jail automatique declenche !' : `${3 - warnCount} warn(s) avant jail automatique` });

    await message.reply({ embeds: [warnEmbed] });

    await logSanction(message.guild, [
      { name: 'Membre',  value: `<@${target.id}>`,            inline: true },
      { name: 'Par',     value: `<@${message.author.id}>`,    inline: true },
      { name: 'Raison',  value: reason,                       inline: false },
      { name: 'Total',   value: `${warnCount}/3`,             inline: true },
    ], `Warn #${warnCount} -- ${target.user.tag}`, '#FFA500');

    if (warnCount >= 3) {
      const prisonChannel = message.guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
      const dureeMin = Math.round(CONFIG.JAIL_DURATION_MS / 60000);

      try {
        const removedRoleIds = await jailMember(target, 'Auto-jail (3 warns)');

        jailsData[target.id] = {
          until: Date.now() + CONFIG.JAIL_DURATION_MS,
          savedRoleIds: removedRoleIds,
          hadRole: removedRoleIds.includes(CONFIG.JAIL_ACCESS_ROLE_ID),
          guildId: message.guild.id,
        };
        saveJails();

        const autoJailEmbed = embed('#FF4444')
          .setTitle('Jail automatique -- 3 warns atteints')
          .setDescription(
            `<@${target.id}> a ete automatiquement emprisonne pour **${dureeMin} minutes** suite a son 3eme warn.\n` +
            `**${removedRoleIds.length}** role(s) retire(s) -- acces restreint au salon prison uniquement.`
          )
          .setFooter({ text: 'Reflechis a tes actes.' });

        await message.channel.send({ embeds: [autoJailEmbed] });

        if (prisonChannel) {
          await prisonChannel.send({
            content: `<@${target.id}>`,
            embeds: [embed('#FF4444')
              .setTitle('Jail automatique')
              .setDescription(`Tu as accumule 3 warns. Tu es emprisonne pour **${dureeMin} min**.\nTu n'as acces qu'a ce salon. Tes roles seront restaures a la liberation.`)
            ],
          });
        }

        await logSanction(message.guild, [
          { name: 'Membre',         value: `<@${target.id}>`,          inline: true },
          { name: 'Duree',          value: `${dureeMin} min`,           inline: true },
          { name: 'Roles retires',  value: `${removedRoleIds.length}`,  inline: true },
          { name: 'Motif',          value: 'Auto-jail (3 warns)',        inline: false },
        ], `Jail auto -- ${target.user.tag}`, '#FF4444');

        setTimeout(async () => {
          try {
            const member = await message.guild.members.fetch(target.id).catch(() => null);
            if (!member) { delete jailsData[target.id]; saveJails(); return; }
            const saved = jailsData[target.id];
            if (saved) {
              await unjailMember(member, saved.savedRoleIds || [], 'Liberation automatique apres jail');
            }
            delete jailsData[target.id];
            saveJails();
            if (prisonChannel) {
              await prisonChannel.send({
                embeds: [embed('#00FF66').setTitle('Libere !').setDescription(`<@${target.id}> a ete libere automatiquement. Ses roles ont ete restaures.`)],
              });
            }
          } catch (err) { console.error('[AUTO-JAIL] Erreur liberation :', err.message); }
        }, CONFIG.JAIL_DURATION_MS);

      } catch (err) {
        console.error('[WARN AUTO-JAIL] Erreur :', err.message);
      }
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
    await message.reply({
      embeds: [embed('#FFA500').setTitle(`Warns de ${target.displayName} -- ${list.length}/3`).addFields(fields)],
    });
  },

  '!clearwarns': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!clearwarns @user`');
    const before = warnsData[target.id]?.length || 0;
    delete warnsData[target.id];
    saveWarns();
    await message.reply(`**${before}** warn(s) supprime(s) pour <@${target.id}>.`);
    await logSanction(message.guild, [
      { name: 'Membre',    value: `<@${target.id}>`,          inline: true },
      { name: 'Par',       value: `<@${message.author.id}>`,  inline: true },
      { name: 'Supprimes', value: `${before} warn(s)`,        inline: true },
    ], `Warns effaces -- ${target.user.tag}`, '#00FF66');
  },

  // EXPIREDJAILS
  '!expiredjails': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const active = Object.entries(jailsData);
    if (active.length === 0) return message.reply('Aucun jail actif en ce moment.');
    const now = Date.now();
    const fields = active.map(([userId, data]) => {
      const remaining = data.until - now;
      const displayTime = remaining > 0
        ? `${Math.ceil(remaining / 1000 / 60)} min restante(s)`
        : 'Liberation en attente...';
      const rolesCount = data.savedRoleIds?.length ?? (data.hadRole ? 1 : 0);
      return {
        name: `<@${userId}>`,
        value: `${displayTime}\nFin : ${new Date(data.until).toLocaleTimeString('fr-FR')}\n${rolesCount} role(s) sauvegarde(s)`,
        inline: true,
      };
    });
    await message.reply({
      embeds: [embed('#FF4444').setTitle(`Jails actifs -- ${active.length} membre(s)`).addFields(fields)],
    });
  },

  // SANCTION LOG
  '!sanction-log': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('Mentionne un salon : `!sanction-log <#channel>`');
    sanctionLogData.channelId = channel.id;
    saveSanctionLog();
    await message.reply(`Salon de logs des sanctions defini : ${channel}`);
  },

  // JAIL
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

      jailsData[target.id] = {
        until: Date.now() + CONFIG.JAIL_DURATION_MS,
        savedRoleIds: removedRoleIds,
        hadRole: removedRoleIds.includes(CONFIG.JAIL_ACCESS_ROLE_ID),
        guildId: message.guild.id,
      };
      saveJails();

      const jailEmbed = embed('#FF4444')
        .setTitle('Emprisonne !')
        .setDescription(
          `<@${target.id}> a ete envoye en prison par <@${message.author.id}>.\n` +
          `**${removedRoleIds.length}** role(s) retire(s) -- tous restaures automatiquement dans **${dureeMin} min**.\n\n` +
          `Seul ${prisonMention} reste accessible.`
        )
        .addFields(
          { name: 'Par',            value: `<@${message.author.id}>`,    inline: true },
          { name: 'Duree',          value: `${dureeMin} min`,             inline: true },
          { name: 'Roles retires',  value: `${removedRoleIds.length}`,    inline: true },
        )
        .setFooter({ text: 'Reflechis a tes actes.' });

      await message.reply({ embeds: [jailEmbed] });

      if (prisonChannel) {
        await prisonChannel.send({
          content: `<@${target.id}>`,
          embeds: [embed('#FF4444')
            .setTitle('Tu es en prison')
            .setDescription(
              `Tu as ete emprisonne par <@${message.author.id}>.\n` +
              `Tu n'as acces qu'a ce salon pendant **${dureeMin} minute${dureeMin > 1 ? 's' : ''}**.\n` +
              `Tous tes roles seront restaures a la liberation.`
            )
          ],
        });
      }

      await logSanction(message.guild, [
        { name: 'Membre',         value: `<@${target.id}>`,          inline: true },
        { name: 'Par',            value: `<@${message.author.id}>`,  inline: true },
        { name: 'Duree',          value: `${dureeMin} min`,           inline: true },
        { name: 'Roles retires',  value: `${removedRoleIds.length}`,   inline: true },
      ], `Jail -- ${target.user.tag}`, '#FF4444');

      console.log(`[JAIL] ${target.user.tag} emprisonne (${removedRoleIds.length} roles retires) -- ${dureeMin} min`);

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete jailsData[target.id]; saveJails(); return; }
          const saved = jailsData[target.id];
          if (saved) {
            await unjailMember(member, saved.savedRoleIds || [], 'Liberation automatique apres jail');
          }
          delete jailsData[target.id];
          saveJails();
          if (prisonChannel) {
            await prisonChannel.send({
              embeds: [embed('#00FF66')
                .setTitle('Libere !')
                .setDescription(`<@${target.id}> a purge sa peine. Tous ses roles ont ete restaures.`)
              ],
            });
          }
          console.log(`[JAIL] ${target.user.tag} libere -- roles restaures.`);
        } catch (err) { console.error('[JAIL] Erreur liberation :', err.message); }
      }, CONFIG.JAIL_DURATION_MS);

    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // TOURNOI
  '!tournoi-start': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');

    const photoChannel = message.mentions.channels.first();
    if (!photoChannel) return message.reply('Mentionne le salon photos : `!tournoi-start <#channel-photos>`');

    const activeTournament = Object.values(tournamentsData).find(t => t.status === 'active');
    if (activeTournament) {
      return message.reply(`Un tournoi est deja en cours (ID: \`${activeTournament.id}\`). Utilise \`!tournoi-cancel\` pour l'annuler.`);
    }

    await message.reply('Recuperation des photos en cours...');

    let allMessages = [];
    let lastId = null;
    let fetchMore = true;

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
    const participants = [];
    const seenUsers = new Set();

    for (const msg of allMessages) {
      if (msg.author.bot) continue;

      const imageAttachment = msg.attachments.find(att =>
        att.contentType?.startsWith('image/') ||
        imageExtensions.test(att.url)
      );

      if (imageAttachment && !seenUsers.has(msg.author.id)) {
        seenUsers.add(msg.author.id);
        participants.push({
          userId: msg.author.id,
          username: msg.member?.displayName || msg.author.username,
          imageUrl: imageAttachment.url,
          messageId: msg.id,
        });
      }
    }

    if (participants.length < 2) {
      return message.reply('Pas assez de participants avec des photos dans ce salon (minimum 2 requis).');
    }

    const tournamentId = Date.now().toString(36);
    const firstRoundPairs = buildRound(participants);

    tournamentsData[tournamentId] = {
      id: tournamentId,
      status: 'active',
      hostChannelId: message.channel.id,
      photoChannelId: photoChannel.id,
      participants: participants,
      currentRound: 1,
      currentMatchIndex: 0,
      currentPairs: firstRoundPairs,
      roundWinners: [],
      allRoundWinners: [],
      history: [],
      startedBy: message.author.id,
      startedAt: new Date().toISOString(),
      currentVoteMessageId: null,
    };
    saveTournaments();

    const startEmbed = embed('#FFD700')
      .setTitle('Tournoi Physique -- Debut !')
      .setDescription(
        `Le tournoi demarre avec **${participants.length} participant(s)** !\n\n` +
        `Photos recuperees depuis ${photoChannel}\n` +
        `Seule **1 photo par personne** est retenue (la plus recente).`
      )
      .addFields(
        { name: 'Participants', value: participants.map(p => `<@${p.userId}>`).join(', ').slice(0, 1024), inline: false },
        { name: 'Matchs au 1er tour', value: `${firstRoundPairs.filter(p => p[1] !== null).length} match(s)`, inline: true },
        { name: 'Format', value: 'Elimination directe', inline: true },
      )
      .setFooter({ text: `Tournoi #${tournamentId} -- Lance par ${message.author.tag}` });

    await message.channel.send({ embeds: [startEmbed] });
    await advanceTournament(tournamentId, message.channel);
  },

  '!tournoi-status': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');

    const activeTournament = Object.values(tournamentsData).find(t => t.status === 'active');
    if (!activeTournament) return message.reply('Aucun tournoi en cours.');

    const t = activeTournament;
    const totalMatches = t.currentPairs.filter(p => p[1] !== null).length;
    const doneMatches = t.currentMatchIndex;

    const statusEmbed = embed('#FFD700')
      .setTitle(`Tournoi #${t.id} -- Round ${t.currentRound}`)
      .addFields(
        { name: 'Progression',     value: `Match ${doneMatches}/${totalMatches}`,                     inline: true },
        { name: 'Participants',    value: `${t.participants.length}`,                                 inline: true },
        { name: `Qualifies (R${t.currentRound})`, value: `${t.roundWinners.length}`,                inline: true },
        { name: 'Lance par',       value: `<@${t.startedBy}>`,                                       inline: true },
        { name: 'Demarre le',      value: new Date(t.startedAt).toLocaleString('fr-FR'),             inline: true },
      );

    await message.reply({ embeds: [statusEmbed] });
  },

  '!tournoi-cancel': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');

    const activeTournament = Object.values(tournamentsData).find(t => t.status === 'active');
    if (!activeTournament) return message.reply('Aucun tournoi en cours.');

    activeTournament.status = 'cancelled';
    saveTournaments();

    await message.reply({
      embeds: [embed('#FF4444')
        .setTitle('Tournoi annule')
        .setDescription(`Le tournoi #${activeTournament.id} a ete annule par <@${message.author.id}>.`)
      ],
    });
  },

  // NPC
  '!npc': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!npc @user`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas npc-ifier un admin.');

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
      npcList[target.id] = { originalNick, until: Date.now() + NPC_DURATION_MS, guildId: message.guild.id };
      saveNpcList();

      const npcEmbed = embed('#95A5A6')
        .setTitle('Statut NPC active')
        .setDescription(
          `<@${target.id}> est desormais un **NPC** pour les **${dureeMin} prochaines minutes**.\n\n` +
          `Ses messages seront traites comme des *interactions scriptees sans valeur cognitive*.`
        )
        .addFields(
          { name: 'Nouveau pseudo', value: newNick,                     inline: true },
          { name: 'Par',            value: `<@${message.author.id}>`,   inline: true },
          { name: 'Duree',          value: `${dureeMin} min`,            inline: true },
        )
        .setFooter({ text: 'NPC Mode -- Retour a la conscience dans quelques minutes.' });

      await message.reply({ embeds: [npcEmbed] });

      await logSanction(message.guild, [
        { name: 'Membre', value: `<@${target.id}>`,          inline: true },
        { name: 'Par',    value: `<@${message.author.id}>`,  inline: true },
        { name: 'Duree',  value: `${dureeMin} min`,           inline: true },
      ], `NPC -- ${target.user.tag}`, '#95A5A6');

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete npcList[target.id]; saveNpcList(); return; }
          const saved = npcList[target.id];
          const restore = saved?.originalNick === target.user.username ? null : saved?.originalNick;
          await member.setNickname(restore, 'Fin du statut NPC');
          delete npcList[target.id];
          saveNpcList();
        } catch (err) { console.error('[NPC] Erreur restauration pseudo :', err.message); }
      }, NPC_DURATION_MS);

    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // RESETPSEUDO
  '!resetpseudo': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!resetpseudo @user`');

    try {
      const oldNick = target.nickname || '*aucun surnom*';
      await target.setNickname(null, `Reset pseudo par ${message.author.tag}`);
      if (npcList[target.id]) { delete npcList[target.id]; saveNpcList(); }
      if (tfList[target.id])  { delete tfList[target.id];  saveTfList();  }
      await message.reply({
        embeds: [embed('#00FF66')
          .setTitle('Pseudo reinitialise')
          .addFields(
            { name: 'Membre',        value: `<@${target.id}>`,          inline: true },
            { name: 'Ancien pseudo', value: oldNick,                     inline: true },
            { name: 'Par',           value: `<@${message.author.id}>`,  inline: true },
          )
        ],
      });
    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // TF
  '!tf': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!tf @user`');
    if (isAdmin(target.id)) return message.reply('Tu ne peux pas transformer un admin.');

    const TF_DURATION_MS = 10 * 60 * 1000;
    const dureeMin = Math.round(TF_DURATION_MS / 60000);
    const originalNick = target.nickname || target.user.username;
    const tfNames = [
      'Le Copeur Certifie', 'M. Fluide 2024', 'Natty Suspect #1',
      'Le Roi du Fenugrec', 'Monsieur Maingain', 'Le Bulk Eternel',
      'Prince du Cope', 'IQ Test Echoue', 'Fonte Imaginaire',
      'Background NPC', 'Zyzz Rate', 'Le Sourceur',
      'Hgh Anonymous', 'Mr. Overdose Creatine', 'Amateur de MK677',
    ];
    const newNick = tfNames[Math.floor(Math.random() * tfNames.length)];

    try {
      await target.setNickname(newNick, `TF par ${message.author.tag}`);
      tfList[target.id] = { originalNick, until: Date.now() + TF_DURATION_MS, guildId: message.guild.id };
      saveTfList();

      const tfEmbed = embed('#9B59B6')
        .setTitle('Transformation activee')
        .setDescription(`<@${target.id}> a ete transforme pour **${dureeMin} minutes**.`)
        .addFields(
          { name: 'Ancien pseudo',  value: originalNick,              inline: true },
          { name: 'Nouveau pseudo', value: newNick,                   inline: true },
          { name: 'Par',            value: `<@${message.author.id}>`, inline: true },
          { name: 'Duree',          value: `${dureeMin} min`,          inline: true },
        )
        .setFooter({ text: 'TF Mode -- Identite temporairement confisquee.' });

      await message.reply({ embeds: [tfEmbed] });

      await logSanction(message.guild, [
        { name: 'Membre',         value: `<@${target.id}>`,          inline: true },
        { name: 'Nouveau pseudo', value: newNick,                    inline: true },
        { name: 'Par',            value: `<@${message.author.id}>`,  inline: true },
      ], `TF -- ${target.user.tag}`, '#9B59B6');

      setTimeout(async () => {
        try {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (!member) { delete tfList[target.id]; saveTfList(); return; }
          const saved = tfList[target.id];
          const restore = saved?.originalNick === target.user.username ? null : saved?.originalNick;
          await member.setNickname(restore, 'Fin du TF');
          delete tfList[target.id];
          saveTfList();
        } catch (err) { console.error('[TF] Erreur restauration pseudo :', err.message); }
      }, TF_DURATION_MS);

    } catch (err) { await message.reply(`Erreur : ${err.message}`); }
  },

  // TICKETS
  '!ticket-setrole': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un role. Exemple : `!ticket-setrole @Membres`');
    ticketConfig.viewRoleId = role.id;
    saveTicketConfig();
    await message.reply(`Role viewer des tickets defini : <@&${role.id}>`);
  },

  '!ticket-setstaff': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un role. Exemple : `!ticket-setstaff @Staff`');
    ticketConfig.staffRoleId = role.id;
    saveTicketConfig();
    await message.reply(`Role staff des tickets defini : <@&${role.id}>`);
  },

  '!ticket-config': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const e = embed('#00FF66')
      .setTitle('Configuration des tickets')
      .addFields(
        { name: 'Role viewer', value: ticketConfig.viewRoleId  ? `<@&${ticketConfig.viewRoleId}>`  : 'Non defini', inline: false },
        { name: 'Role staff',  value: ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : 'Non defini', inline: false },
      );
    await message.reply({ embeds: [e] });
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
      const channel = await guild.channels.create({
        name: `ticket-${ticketNumber}`, type: 0,
        permissionOverwrites: overwrites,
        reason: `Ticket #${ticketNumber} ouvert par ${message.author.tag}`,
      });
      ticketsData[channel.id] = { openerId: message.author.id, openerTag: message.author.tag, ticketNumber, motif, openedAt: new Date().toISOString() };
      saveTickets();
      const staffMention = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '';
      const ticketEmbed = embed('#00FF66')
        .setTitle(`Ticket #${ticketNumber}`)
        .setDescription('Le staff va traiter ta demande sous 24h.\n\n> Pour fermer ce ticket, utilise `!fermer`')
        .addFields({ name: 'Ouvert par', value: `<@${message.author.id}>`, inline: true }, { name: 'Motif', value: motif, inline: false })
        .setFooter({ text: `Ticket #${ticketNumber}` });
      await channel.send({ content: `<@${message.author.id}>${staffMention ? ` ${staffMention}` : ''}`, embeds: [ticketEmbed] });
      const confirmMsg = await message.channel.send(`Ton ticket a ete cree : ${channel}`).catch(() => null);
      if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => {}), 6000);
    } catch (error) {
      console.error('Erreur creation ticket:', error);
      const errMsg = await message.channel.send(`Impossible de creer le ticket : ${error.message}`).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
    }
  },

  '!fermer': async (message) => {
    try { await message.delete(); } catch {}
    const channelId  = message.channel.id;
    const ticketInfo = ticketsData[channelId];
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
    const closeEmbed = embed('#FF4444')
      .setTitle('Ticket ferme')
      .setDescription(`Ce ticket a ete ferme par <@${message.author.id}>.\n\nLe salon sera supprime dans **5 secondes**.`)
      .addFields({ name: 'Ouvert par', value: `<@${ticketInfo.openerId}>`, inline: true }, { name: 'Motif', value: ticketInfo.motif, inline: false })
      .setFooter({ text: `Ticket #${ticketInfo.ticketNumber}` });
    await message.channel.send({ embeds: [closeEmbed] }).catch(() => {});
    delete ticketsData[channelId];
    saveTickets();
    setTimeout(async () => {
      try { await message.channel.delete(`Ticket ferme par ${message.author.tag}`); }
      catch (err) { console.error('[FERMER] Erreur suppression salon :', err.message); }
    }, 5000);
  },

  // REACTION ROLES
  '!rr-setup': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('Format : `!rr-setup <#channel> | <titre> | <description (optionnelle)>`');
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) return message.reply('Mentionne un channel valide.');
    const titre       = parts[1];
    const description = parts[2] || 'Reagis avec les emojis ci-dessous pour obtenir tes roles !';
    const rrEmbed = embed('#7289DA')
      .setTitle(`${titre}`)
      .setDescription(description)
      .addFields({ name: 'Roles disponibles', value: '*Aucun role configure pour l\'instant.*', inline: false })
      .setFooter({ text: 'Reagis pour obtenir un role - Retire ta reaction pour le perdre' });
    const sent = await targetChannel.send({ embeds: [rrEmbed] });
    reactionRolesData[sent.id] = { channelId: targetChannel.id, titre, description, roles: {}, existingMessage: false };
    saveReactionRoles();
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
    reactionRolesData[messageId] = { channelId: targetChannel.id, titre, description, roles: {}, existingMessage: true };
    saveReactionRoles();
    await message.reply(`Message \`${messageId}\` enregistre comme reaction role dans ${targetChannel} !`);
  },

  '!rr-add': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) return message.reply('Format : `!rr-add <messageID> | <emoji> | <@role>`');
    const messageId = parts[0];
    const emoji     = parts[1];
    const role      = message.mentions.roles.first();
    if (!role) return message.reply('Mentionne un role valide.');
    if (!reactionRolesData[messageId]) return message.reply(`Message introuvable avec l'ID \`${messageId}\`.`);
    const rrEntry = reactionRolesData[messageId];
    if (rrEntry.roles[emoji]) return message.reply(`L'emoji ${emoji} est deja utilise.`);
    try {
      const targetChannel = await client.channels.fetch(rrEntry.channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      await targetMessage.react(emoji);
      rrEntry.roles[emoji] = role.id;
      saveReactionRoles();
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
      delete reactionRolesData[messageId].roles[emoji];
      saveReactionRoles();
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
          try {
            const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji);
            if (reaction) await reaction.users.remove(client.user.id);
          } catch {}
        }
      } else {
        await targetMessage.delete();
      }
    } catch { console.warn('[RR-DELETE] Message introuvable ou deja supprime.'); }
    delete reactionRolesData[messageId];
    saveReactionRoles();
    await message.reply(rrEntry.existingMessage
      ? `Config RR retiree du message \`${messageId}\` (message original conserve).`
      : `Message RR \`${messageId}\` supprime.`);
  },

  // ETUDES / PUBMED
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

  // COPE
  '!cope': async (message) => {
    const copeList        = copesData.cope.length        > 0 ? copesData.cope.map((c, i)        => `${i + 1}. ${c}`).join('\n') : '*Aucun complement.*';
    const interestingList = copesData.interesting.length > 0 ? copesData.interesting.map((c, i) => `${i + 1}. ${c}`).join('\n') : '*Aucun complement.*';
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('Liste des complements').addFields(
      { name: 'COPE (Inutiles)',   value: copeList.slice(0, 1024),        inline: false },
      { name: 'Interessants',       value: interestingList.slice(0, 1024), inline: false },
    ).setFooter({ text: `${copesData.cope.length} cope(s) | ${copesData.interesting.length} interessant(s)` })] });
  },

  '!add-cope': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('Format : `!add-cope <nom>`');
    if (copesData.cope.includes(name)) return message.reply('Deja dans la liste Cope.');
    copesData.cope.push(name); saveJSON(FILES.copes, copesData);
    await message.reply(`**${name}** ajoute a la liste Cope.`);
  },

  '!add-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim();
    if (!name) return message.reply('Format : `!add-interesting <nom>`');
    if (copesData.interesting.includes(name)) return message.reply('Deja dans la liste Interessants.');
    copesData.interesting.push(name); saveJSON(FILES.copes, copesData);
    await message.reply(`**${name}** ajoute a la liste Interessants.`);
  },

  '!remove-cope': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim();
    const idx  = copesData.cope.indexOf(name);
    if (idx === -1) return message.reply(`**${name}** introuvable dans Cope.`);
    copesData.cope.splice(idx, 1); saveJSON(FILES.copes, copesData);
    await message.reply(`**${name}** retire de la liste Cope.`);
  },

  '!remove-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const name = args.join(' ').trim();
    const idx  = copesData.interesting.indexOf(name);
    if (idx === -1) return message.reply(`**${name}** introuvable dans Interessants.`);
    copesData.interesting.splice(idx, 1); saveJSON(FILES.copes, copesData);
    await message.reply(`**${name}** retire de la liste Interessants.`);
  },

  // REGLES
  '!regles': async (message) => {
    const rulesList = Object.entries(rulesData).sort(([a], [b]) => Number(a) - Number(b)).map(([n, text]) => `**${n}.** ${text}`).join('\n');
    await message.reply({ embeds: [embed('#FAD961').setTitle('Regles du serveur').setDescription(rulesList || '*Aucune regle definie.*')] });
  },

  '!set-regle': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2 || isNaN(Number(parts[0]))) return message.reply('Format : `!set-regle <numero> | <texte>`');
    rulesData[parts[0]] = parts[1]; saveJSON(FILES.rules, rulesData);
    await message.reply(`Regle **${parts[0]}** mise a jour.`);
  },

  // MODERATION
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

  // FLUIDE
  '!fluide': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('Permission refusee.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('Mentionne un utilisateur : `!fluide @user`');
    const motifs = [
      'comportement inexplicable detecte', 'neurones dysfonctionnels confirmes',
      'coherence logique introuvable', 'ratio subi sans broncher',
      'a defendu un cope en public', 'a demande une source',
      'a mentionne le MK-677 volontairement', 'analyse biometrique : QI fluide detecte',
      'a pris du fenugrec en pensant que ca servait a quelque chose',
      'a confondu creatine et steroides pour la 3eme fois',
    ];
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    await message.reply({ embeds: [embed('#9B59B6')
      .setTitle('Systeme Fluide Active')
      .setDescription(`<@${target.id}> est officiellement passe sous **systeme fluide** pour les prochaines **24h**.\n\nConformement a la regle 3, les insultes et ratios a son encontre sont desormais **autorises et encourages**.`)
      .addFields(
        { name: 'Motif detecte', value: motif,                                 inline: false },
        { name: 'Statut',        value: 'FLUIDE -- Protection sociale retiree', inline: true  },
        { name: 'Duree estimee', value: '24h (ou jusqu\'a guerison)',          inline: true  },
      )
      .setFooter({ text: `Decision prise par ${message.author.displayName} -- Systeme Fluide` })
    ] });
  },

  // IQTEST
  '!iqtest': async (message) => {
    const target  = message.mentions.members.first() || message.member;
    const base    = isAdmin(message.author.id) ? 110 : 90;
    const iq      = Math.floor(base + (Math.random() * 80) - 40);
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

  // COPE DU JOUR
  '!cope-du-jour': async (message) => {
    if (copesData.cope.length === 0) return message.reply('Aucun cope dans la liste. Utilise `!add-cope` pour en ajouter.');
    const random = copesData.cope[Math.floor(Math.random() * copesData.cope.length)];
    const refutations = [
      'Aucune etude peer-reviewed ne supporte cette affirmation.',
      'Des scientifiques ont tente de reproduire ces resultats. Ils pleurent encore.',
      'Efficacite prouvee sur 3 personnes dont 2 qui voulaient recuperer leur argent.',
      'Le seul effet documente : appauvrissement du portefeuille.',
      'Meta-analyse de 0 etudes conclut a l\'absence totale d\'effet.',
      'Recommande par des influenceurs fitness. C\'est tout ce qu\'on dira.',
      'La FDA, l\'EFSA et ton medecin generaliste ont ri en choeur.',
      'Fonctionne tres bien sur des souris. Toi, tu n\'es pas une souris.',
      'Approuve par des gens qui vendent aussi des colliers magnetiques.',
      'L\'etude citee : un blog wordpress de 2011 sans sources.',
    ];
    const refutation = refutations[Math.floor(Math.random() * refutations.length)];
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('Cope du jour').addFields(
      { name: 'Produit du jour',   value: `**${random}**`, inline: false },
      { name: 'Avis scientifique', value: refutation,      inline: false },
    ).setFooter({ text: 'Base sur des donnees solides. Tres solides. Betonnees.' })] });
  },

  // MOMMY ASMR
  '!mommy-asmr': async (message) => {
    if (!CONFIG.MOMMY_ASMR_USER_IDS.includes(message.author.id)) return message.reply('Permission refusee.');
    try {
      await message.channel.send({ content: 'Mommy ASMR en approche...', files: [CONFIG.MOMMY_ASMR_FILE_URL] });
    } catch (err) { await message.reply(`Echec envoi ASMR : ${err.message}`); }
  },
};

// ============================================================
//  TOURNOI -- LOGIQUE D'AVANCEMENT
// ============================================================

async function advanceTournament(tournamentId, channel) {
  const t = tournamentsData[tournamentId];
  if (!t || t.status !== 'active') return;

  const pairs = t.currentPairs;

  while (t.currentMatchIndex < pairs.length) {
    const [p1, p2] = pairs[t.currentMatchIndex];

    if (p2 === null) {
      console.log(`[TOURNOI] Bye pour ${p1.username} (match ${t.currentMatchIndex + 1})`);
      t.roundWinners.push(p1);
      t.history.push({ round: t.currentRound, match: t.currentMatchIndex + 1, winner: p1, loser: null, bye: true });
      t.currentMatchIndex++;
      saveTournaments();
      continue;
    }

    const voteMsgId = await sendVersus(channel, tournamentId, t.currentMatchIndex, p1, p2);
    t.currentVoteMessageId = voteMsgId;
    saveTournaments();
    return;
  }

  const winners = t.roundWinners;

  if (winners.length === 1) {
    t.status = 'finished';
    t.winner = winners[0];
    saveTournaments();

    const winnerEmbed = embed('#FFD700')
      .setTitle('VICTOIRE FINALE !')
      .setDescription(
        `**${winners[0].username}** remporte le tournoi physique !\n\n` +
        `Felicitations a <@${winners[0].userId}> pour avoir battu tous les adversaires !`
      )
      .addFields(
        { name: 'Gagnant',        value: `<@${winners[0].userId}>`,                            inline: true },
        { name: 'Participants',    value: `${t.participants.length}`,                           inline: true },
        { name: 'Rounds joues',   value: `${t.currentRound}`,                                  inline: true },
      )
      .setFooter({ text: `Tournoi #${tournamentId} -- Termine` });

    await channel.send({ content: '@everyone', embeds: [winnerEmbed] });
    return;
  }

  t.currentRound++;
  t.allRoundWinners.push(...t.roundWinners);
  t.currentPairs   = buildRound(winners);
  t.currentMatchIndex = 0;
  t.roundWinners   = [];
  saveTournaments();

  const roundEmbed = embed('#FFD700')
    .setTitle(`Round ${t.currentRound} -- Debut !`)
    .setDescription(`**${winners.length} joueurs** s'affrontent pour le round ${t.currentRound} !`)
    .addFields(
      { name: 'Qualifies', value: winners.map(w => `<@${w.userId}>`).join(', ').slice(0, 1024), inline: false },
    );

  await channel.send({ embeds: [roundEmbed] });
  await advanceTournament(tournamentId, channel);
}

// ============================================================
//  HANDLER -- Boutons de tournoi
// ============================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  if (!customId.startsWith('tournament_')) return;

  if (!isAdmin(interaction.user.id)) {
    return interaction.reply({ content: 'Seul Crous peut voter.', ephemeral: true });
  }

  const parts = customId.split('_');
  const choice       = parts[parts.length - 1];
  const matchIndex   = parseInt(parts[parts.length - 2]);
  const tournamentId = parts.slice(1, parts.length - 2).join('_');

  const t = tournamentsData[tournamentId];
  if (!t || t.status !== 'active') {
    return interaction.reply({ content: 'Ce tournoi n\'est plus actif.', ephemeral: true });
  }

  if (matchIndex !== t.currentMatchIndex) {
    return interaction.reply({ content: 'Ce vote est obsolete.', ephemeral: true });
  }

  const [p1, p2] = t.currentPairs[matchIndex];
  const winner = choice === 'A' ? p1 : p2;
  const loser  = choice === 'A' ? p2 : p1;

  t.roundWinners.push(winner);
  t.history.push({ round: t.currentRound, match: matchIndex + 1, winner, loser, bye: false });
  t.currentMatchIndex++;
  saveTournaments();

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('done_A')
      .setLabel(choice === 'A' ? 'Joueur A (Gagnant)' : 'Joueur A')
      .setStyle(choice === 'A' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('done_B')
      .setLabel(choice === 'B' ? 'Joueur B (Gagnant)' : 'Joueur B')
      .setStyle(choice === 'B' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(true),
  );

  await interaction.update({ components: [disabledRow] }).catch(() => {});

  await interaction.channel.send({
    embeds: [embed('#00FF66')
      .setTitle(`Match ${matchIndex + 1} -- Resultat`)
      .addFields(
        { name: 'Gagnant', value: `<@${winner.userId}> (${winner.username})`, inline: true },
        { name: 'Elimine', value: `<@${loser.userId}> (${loser.username})`,   inline: true },
      )
    ],
  });

  await advanceTournament(tournamentId, interaction.channel);
});

// ============================================================
//  HANDLER MESSAGES
// ============================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
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
//  REACTION ROLES
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
      if (!role) return console.error('[REACTION ROLE] Role introuvable :', ROLE_ID);
      await member.roles.add(role);
      console.log(`[REACTION ROLE] Role "${role.name}" donne a ${user.tag}`);
      try { await user.send('Tu as bien recu l\'acces au serveur ! Bienvenue !'); } catch {}
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
//  TIKTOK LIVE CHECKER
// ============================================================

let liveDetectionStreak = 0;
const LIVE_DETECTION_THRESHOLD = 2;

async function checkTikTokLive() {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Mode': 'navigate',
    };

    const response = await axios.get(
      `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`,
      { headers, timeout: 15000, maxRedirects: 5 }
    );

    const html = response.data;

    const patterns = [
      /"statusStr"\s*:\s*"LIVE_STATUS_STREAMING"/.test(html),
      /"isLiveStreaming"\s*:\s*true/.test(html),
      /"liveRoomInfo"/.test(html) && /"status"\s*:\s*2/.test(html),
      /roomid[^"]*"[^"]{5,}/.test(html) && !/redirectUrl/.test(html),
      /"liveUrl"/.test(html) && !/"liveUrl"\s*:\s*""/.test(html),
    ];

    const positiveSignals = patterns.filter(Boolean).length;
    const isCurrentlyLive = positiveSignals >= 2;

    console.log(`[LIVE CHECK] @${CONFIG.TIKTOK_USERNAME} -- ${positiveSignals}/5 signaux positifs -- Streak: ${liveDetectionStreak}`);

    const channel = client.channels.cache.get(CONFIG.LIVE_CHANNEL_ID);
    if (!channel) {
      console.error(`[LIVE] Channel ${CONFIG.LIVE_CHANNEL_ID} introuvable.`);
      return;
    }

    if (isCurrentlyLive) {
      liveDetectionStreak++;

      if (liveDetectionStreak >= LIVE_DETECTION_THRESHOLD && !liveStatus.isLive) {
        liveStatus.isLive       = true;
        liveStatus.lastNotified = new Date().toISOString();
        saveJSON(FILES.liveStatus, liveStatus);

        const liveEmbed = embed('#FF0050')
          .setTitle('LIVE EN COURS !')
          .setDescription(
            `**@${CONFIG.TIKTOK_USERNAME}** est actuellement en **live** sur TikTok !\n\n` +
            `Clique sur le lien ci-dessous pour rejoindre le live.`
          )
          .addFields(
            { name: 'Lien direct',   value: `https://www.tiktok.com/@${CONFIG.TIKTOK_USERNAME}/live`, inline: false },
            { name: 'Detecte a',     value: `<t:${Math.floor(Date.now() / 1000)}:T>`,                inline: true  },
          )
          .setThumbnail(`https://unavatar.io/tiktok/${CONFIG.TIKTOK_USERNAME}`)
          .setFooter({ text: `TikTok Live Detector - @${CONFIG.TIKTOK_USERNAME}` });

        await channel.send({
          content: `@everyone **@${CONFIG.TIKTOK_USERNAME}** est en live sur TikTok !`,
          embeds: [liveEmbed],
        });

        console.log(`[LIVE] @${CONFIG.TIKTOK_USERNAME} est en live -- Notification envoyee.`);
      }

    } else {
      if (liveDetectionStreak > 0) {
        console.log(`[LIVE] Streak reinitialise (${liveDetectionStreak} -> 0)`);
        liveDetectionStreak = 0;
      }

      if (liveStatus.isLive) {
        liveStatus.isLive = false;
        saveJSON(FILES.liveStatus, liveStatus);
        console.log(`[LIVE] @${CONFIG.TIKTOK_USERNAME} a termine son live.`);
      }
    }

  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[LIVE] Rate limit TikTok -- Pause temporaire.');
    } else if (err.response?.status === 404) {
      console.warn(`[LIVE] Page TikTok introuvable pour @${CONFIG.TIKTOK_USERNAME}`);
    } else {
      console.error('[LIVE] Erreur verification TikTok:', err.message);
    }
  }
}

// ============================================================
//  RESTAURATION DES TIMERS AU DEMARRAGE
// ============================================================

async function restoreTimers() {
  const now = Date.now();

  // Jails
  for (const [userId, data] of Object.entries(jailsData)) {
    const remaining    = data.until - now;
    const savedRoleIds = data.savedRoleIds || (data.hadRole ? [CONFIG.JAIL_ACCESS_ROLE_ID] : []);

    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        if (!guild) { delete jailsData[userId]; continue; }
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          await unjailMember(member, savedRoleIds, 'Liberation automatique (rattrapage demarrage)');
        }
      } catch (err) { console.error('[RESTORE JAIL] Erreur :', err.message); }
      delete jailsData[userId];
    } else {
      console.log(`[RESTORE] Jail restaure pour ${userId} -- ${Math.ceil(remaining / 1000 / 60)} min restantes (${savedRoleIds.length} roles sauvegardes)`);
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          if (!guild) { delete jailsData[userId]; saveJails(); return; }
          const member = await guild.members.fetch(userId).catch(() => null);
          const saved  = jailsData[userId];
          if (member && saved) {
            await unjailMember(member, saved.savedRoleIds || [], 'Liberation automatique apres jail');
          }
          delete jailsData[userId]; saveJails();
          console.log(`[RESTORE JAIL] ${userId} libere -- roles restaures et overwrites supprimes.`);
          const prisonCh = guild.channels.cache.get(CONFIG.JAIL_PRISON_CHANNEL_ID);
          if (prisonCh) {
            await prisonCh.send({
              embeds: [embed('#00FF66').setTitle('Libere !').setDescription(`<@${userId}> a purge sa peine. Tous ses roles ont ete restaures.`)],
            }).catch(() => {});
          }
        } catch (err) { console.error('[RESTORE JAIL] Erreur liberation :', err.message); }
      }, remaining);
    }
  }
  saveJails();

  // NPC
  for (const [userId, data] of Object.entries(npcList)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        if (member) {
          const restore = data.originalNick === member.user.username ? null : data.originalNick;
          await member.setNickname(restore, 'Fin NPC (rattrapage demarrage)');
        }
      } catch {}
      delete npcList[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
          if (member) {
            const restore = data.originalNick === member.user.username ? null : data.originalNick;
            await member.setNickname(restore, 'Fin du statut NPC');
          }
          delete npcList[userId]; saveNpcList();
        } catch {}
      }, remaining);
    }
  }
  saveNpcList();

  // TF
  for (const [userId, data] of Object.entries(tfList)) {
    const remaining = data.until - now;
    if (remaining <= 0) {
      try {
        const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        if (member) {
          const restore = data.originalNick === member.user.username ? null : data.originalNick;
          await member.setNickname(restore, 'Fin TF (rattrapage demarrage)');
        }
      } catch {}
      delete tfList[userId];
    } else {
      setTimeout(async () => {
        try {
          const guild  = await client.guilds.fetch(data.guildId).catch(() => null);
          const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
          if (member) {
            const restore = data.originalNick === member.user.username ? null : data.originalNick;
            await member.setNickname(restore, 'Fin du TF');
          }
          delete tfList[userId]; saveTfList();
        } catch {}
      }, remaining);
    }
  }
  saveTfList();

  console.log('[RESTORE] Timers restaures avec succes.');
}

// ============================================================
//  DEMARRAGE
// ============================================================

client.once('ready', async () => {
  console.log(`Bot connecte en tant que ${client.user.tag}`);
  console.log(`Admins: ${CONFIG.ADMIN_IDS.join(', ')}`);
  console.log(`Surveillance TikTok: @${CONFIG.TIKTOK_USERNAME}`);
  console.log(`Channel live: ${CONFIG.LIVE_CHANNEL_ID}`);
  console.log(`Multi-RR charges: ${Object.keys(reactionRolesData).length} message(s)`);
  console.log(`Ticket viewer role: ${ticketConfig.viewRoleId  || 'non defini'}`);
  console.log(`Ticket staff role:  ${ticketConfig.staffRoleId || 'non defini'}`);
  console.log(`Tickets actifs: ${Object.keys(ticketsData).length}`);
  console.log(`Jail prison channel: ${CONFIG.JAIL_PRISON_CHANNEL_ID}`);
  console.log(`Sanction log channel: ${sanctionLogData.channelId || 'non defini'}`);
  console.log(`Warns charges: ${Object.keys(warnsData).length} membre(s)`);
  console.log(`Jails actifs: ${Object.keys(jailsData).length}`);

  await restoreTimers();

  checkTikTokLive();
  setInterval(checkTikTokLive, CONFIG.LIVE_CHECK_INTERVAL);
});

client.on('error', (err) => console.error('[Discord] Erreur client:', err));

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('DISCORD_TOKEN manquant ! Definissez la variable d\'environnement.');
  process.exit(1);
}

client.login(TOKEN);
