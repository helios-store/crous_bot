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
 
  MOMMY_ASMR_USER_IDS: ['1469795368580677717', '535857300552810526'],
  MOMMY_ASMR_FILE_URL: 'https://cdn.discordapp.com/attachments/817794666778460160/1488669778313875606/ScreenRecording_03-20-2026_22-35-55_1.mp3?ex=69cd9f45&is=69cc4dc5&hm=23794ca2a2df4bb6ea4165d69675a442729720e01dd8abf70f1793270e97be2c&',
 
  // Reaction role simple (vérification)
  REACTION_ROLE: {
    MESSAGE_ID: '1488290011425149022',
    CHANNEL_ID: '1488289976540991770',
    ROLE_ID:    '1487674672865611806',
    EMOJI:      '✅',
  },
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
let reactionRolesData = loadJSON(FILES.reactionRoles, {});
let ticketsData = loadJSON(FILES.tickets, {}); // { channelId: { openerId, ticketNumber } }
 
let ticketConfig = loadJSON(FILES.ticketConfig, {
  viewRoleId: null,
  staffRoleId: null,
});
 
function saveReactionRoles() { saveJSON(FILES.reactionRoles, reactionRolesData); }
function saveTicketConfig()   { saveJSON(FILES.ticketConfig, ticketConfig); }
function saveTickets()        { saveJSON(FILES.tickets, ticketsData); }
 
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
//  🔄  HELPER — Met à jour l'embed du message RR
// ============================================================
 
async function updateRREmbed(targetMessage, rrEntry) {
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
 
  // --- AIDE ---
  '!aide': async (message) => {
    const viewRoleDisplay = ticketConfig.viewRoleId ? `<@&${ticketConfig.viewRoleId}>` : '*non défini*';
    const staffRoleDisplay = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '*non défini (admins seulement)*';
 
    const e = embed('#5865F2')
      .setTitle('📖 Commandes disponibles')
      .addFields(
        { name: '📑 Études', value: '`!pubmed`\n`!def-etude <titre> | <url> | <description>` *(admin)*', inline: false },
        { name: '💊 Compléments', value: '`!cope`\n`!add-cope` / `!add-interesting` / `!remove-cope` / `!remove-interesting` *(admin)*', inline: false },
        { name: '📜 Règles', value: '`!regles` • `!regle<N>` • `!set-regle <N> | <texte>` *(admin)*', inline: false },
        { name: '🔨 Modération', value: '`!ban <@user> [raison]` • `!source` • `!mk677`', inline: false },
        { name: '📢 Annonces', value: '`!say <#channel> | <titre> | <description> | [couleur] | [image_url] | [footer]` *(admin)*', inline: false },
        { name: '🎫 Tickets', value: [
          '`!ticket <motif>` — Ouvre un ticket',
          '`!fermer` — Ferme le ticket (dans le salon ticket)',
          '`!ticket-setrole @role` — Définit le rôle qui voit les tickets *(admin)*',
          '`!ticket-setstaff @role` — Définit le rôle staff qui peut écrire *(admin)*',
          '`!ticket-config` — Affiche la config actuelle *(admin)*',
          `\nRôle viewer actuel : ${viewRoleDisplay}`,
          `Rôle staff actuel : ${staffRoleDisplay}`,
        ].join('\n'), inline: false },
        { name: '🎭 Reaction Roles *(admin)*', value: [
          '`!rr-setup <#channel> | <titre> | <description>`',
          '`!rr-add <messageID> | <emoji> | <@role>`',
          '`!rr-remove <messageID> | <emoji>`',
          '`!rr-list` • `!rr-delete <messageID>`',
        ].join('\n'), inline: false },
        { name: '🎵 ASMR', value: '`!mommy-asmr` *(IDs autorisés)*', inline: false },
        { name: '🔴 Live', value: 'Détection auto des lives TikTok', inline: false },
      )
      .setFooter({ text: '*(admin) = Réservé aux utilisateurs autorisés' });
    await message.reply({ embeds: [e] });
  },

  // ============================================================
  //  📢  SAY — Embed personnalisable
  // ============================================================

  '!say': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');

    // Suppression du message de commande
    try { await message.delete(); } catch {}

    // Format : !say <#channel> | <titre> | <description> | [couleur] | [image_url] | [footer]
    const parts = args.join(' ').split('|').map(s => s.trim());

    if (parts.length < 3) {
      try {
        const errMsg = await message.channel.send('❌ Format : `!say <#channel> | <titre> | <description> | [couleur] | [image_url] | [footer]`\nExemple : `!say #général | 📢 Annonce | Bienvenue ! | #FF0000 | | Modération`');
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

    // Validation couleur hex basique
    const validColor = /^#[0-9A-Fa-f]{6}$/.test(couleur) ? couleur : '#5865F2';

    const sayEmbed = new EmbedBuilder()
      .setColor(validColor)
      .setTitle(titre)
      .setDescription(description)
      .setTimestamp();

    if (imageUrl) {
      try { sayEmbed.setImage(imageUrl); } catch {}
    }
    if (footer) {
      sayEmbed.setFooter({ text: footer });
    }

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
  //  🎫  TICKETS
  // ============================================================
 
  '!ticket-setrole': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mentionne un rôle. Exemple : `!ticket-setrole @Membres`');
    ticketConfig.viewRoleId = role.id;
    saveTicketConfig();
    await message.reply(`✅ Rôle viewer des tickets défini : <@&${role.id}>\nCe rôle pourra **voir** les tickets mais pas y écrire.`);
  },
 
  '!ticket-setstaff': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mentionne un rôle. Exemple : `!ticket-setstaff @Staff`');
    ticketConfig.staffRoleId = role.id;
    saveTicketConfig();
    await message.reply(`✅ Rôle staff des tickets défini : <@&${role.id}>\nCe rôle pourra **voir et écrire** dans les tickets.`);
  },
 
  '!ticket-config': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const e = embed('#00FF66')
      .setTitle('🎫 Configuration des tickets')
      .addFields(
        {
          name: '👁️ Rôle viewer (voit mais ne peut pas écrire)',
          value: ticketConfig.viewRoleId ? `<@&${ticketConfig.viewRoleId}>` : '❌ Non défini — utilise `!ticket-setrole @role`',
          inline: false,
        },
        {
          name: '✍️ Rôle staff (voit et peut écrire)',
          value: ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '⚠️ Non défini — seuls les admins du bot peuvent écrire\nUtilise `!ticket-setstaff @role`',
          inline: false,
        },
      );
    await message.reply({ embeds: [e] });
  },
 
  '!ticket': async (message, args) => {
    // Suppression du message de commande
    try { await message.delete(); } catch {}

    const motif = args.join(' ').trim();
    if (!motif) {
      const errMsg = await message.channel.send('❌ Format : `!ticket <motif>`\nExemple : `!ticket Je conteste mon warn du 20/03`').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
      return;
    }
 
    const guild = message.guild;
    const ticketNumber = Math.floor(1000 + Math.random() * 9000);
 
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    ];
 
    if (ticketConfig.viewRoleId) {
      const viewRole = guild.roles.cache.get(ticketConfig.viewRoleId);
      if (viewRole) {
        overwrites.push({
          id: viewRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
          deny: [PermissionsBitField.Flags.SendMessages],
        });
      }
    }
 
    if (ticketConfig.staffRoleId) {
      const staffRole = guild.roles.cache.get(ticketConfig.staffRoleId);
      if (staffRole) {
        overwrites.push({
          id: staffRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
        });
      }
    }
 
    overwrites.push({
      id: message.author.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    });

    for (const adminId of CONFIG.ADMIN_IDS) {
      try {
        const adminMember = await guild.members.fetch(adminId);
        if (adminMember) {
          overwrites.push({
            id: adminMember.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
          });
        }
      } catch {
        console.warn(`[TICKET] Admin ${adminId} introuvable dans le serveur, ignoré.`);
      }
    }
 
    try {
      const channel = await guild.channels.create({
        name: `ticket-${ticketNumber}`,
        type: 0,
        permissionOverwrites: overwrites,
        reason: `Ticket #${ticketNumber} ouvert par ${message.author.tag}`,
      });

      // Sauvegarde du ticket pour la commande !fermer
      ticketsData[channel.id] = {
        openerId: message.author.id,
        openerTag: message.author.tag,
        ticketNumber,
        motif,
        openedAt: new Date().toISOString(),
      };
      saveTickets();
 
      const staffMention = ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : '';
 
      const ticketEmbed = embed('#00FF66')
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription('Le staff va traiter ta demande sous 24h.\n\n> Pour fermer ce ticket, utilise la commande `!fermer`')
        .addFields(
          { name: '🧾 Ouvert par', value: `<@${message.author.id}>`, inline: true },
          { name: '📌 Motif', value: motif, inline: false },
        )
        .setFooter({ text: `Ticket #${ticketNumber}` });
 
      await channel.send({
        content: `<@${message.author.id}>${staffMention ? ` ${staffMention}` : ''}`,
        embeds: [ticketEmbed],
      });

      // Confirmation éphémère dans le salon d'origine
      const confirmMsg = await message.channel.send(`✅ Ton ticket a été créé : ${channel}`).catch(() => null);
      if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => {}), 6000);

    } catch (error) {
      console.error('Erreur création ticket:', error);
      const errMsg = await message.channel.send(`❌ Impossible de créer le ticket : ${error.message}`).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 6000);
    }
  },

  // --- FERMER UN TICKET ---
  '!fermer': async (message) => {
    // Suppression du message de commande
    try { await message.delete(); } catch {}

    const channelId = message.channel.id;
    const ticketInfo = ticketsData[channelId];

    // Vérifier que ce salon est bien un ticket
    if (!ticketInfo) {
      const errMsg = await message.channel.send('❌ Cette commande ne peut être utilisée que dans un salon ticket.').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }

    // Autorisation : opener du ticket ou admin
    const canClose = isAdmin(message.author.id) || message.author.id === ticketInfo.openerId;
    if (!canClose) {
      const errMsg = await message.channel.send('❌ Seul le staff ou la personne qui a ouvert ce ticket peut le fermer.').catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }

    const closedBy = message.author.id;

    const closeEmbed = embed('#FF4444')
      .setTitle('🔒 Ticket fermé')
      .setDescription(`Ce ticket a été fermé par <@${closedBy}>.\n\nLe salon sera supprimé dans **5 secondes**.`)
      .addFields(
        { name: '🧾 Ouvert par', value: `<@${ticketInfo.openerId}>`, inline: true },
        { name: '📌 Motif', value: ticketInfo.motif, inline: false },
      )
      .setFooter({ text: `Ticket #${ticketInfo.ticketNumber}` });

    await message.channel.send({ embeds: [closeEmbed] }).catch(() => {});

    // Suppression du ticket de la liste + suppression du salon après délai
    delete ticketsData[channelId];
    saveTickets();

    setTimeout(async () => {
      try {
        await message.channel.delete(`Ticket fermé par ${message.author.tag}`);
      } catch (err) {
        console.error('[FERMER] Erreur suppression salon :', err.message);
      }
    }, 5000);
  },
 
  // ============================================================
  //  🎭  MULTI-REACTION ROLES — Commandes de setup
  // ============================================================
 
  '!rr-setup': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!rr-setup <#channel> | <titre> | <description (optionnelle)>`');
 
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) return message.reply('❌ Mentionne un channel valide.');
 
    const titre = parts[1];
    const description = parts[2] || 'Réagis avec les emojis ci-dessous pour obtenir tes rôles !';
 
    const rrEmbed = embed('#7289DA')
      .setTitle(`🎭 ${titre}`)
      .setDescription(description)
      .addFields({ name: '📋 Rôles disponibles', value: '*Aucun rôle configuré pour l\'instant.*', inline: false })
      .setFooter({ text: 'Réagis pour obtenir un rôle • Retire ta réaction pour le perdre' });
 
    const sent = await targetChannel.send({ embeds: [rrEmbed] });
 
    reactionRolesData[sent.id] = { channelId: targetChannel.id, titre, description, roles: {} };
    saveReactionRoles();
 
    await message.reply(`✅ Message de reaction role créé dans ${targetChannel} !\n📋 ID : \`${sent.id}\`\n\nAjoute des rôles avec : \`!rr-add ${sent.id} | 🔴 | @MonRole\``);
  },
 
  '!rr-add': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 3) return message.reply('❌ Format : `!rr-add <messageID> | <emoji> | <@role>`');
 
    const messageId = parts[0];
    const emoji = parts[1];
    const role = message.mentions.roles.first();
 
    if (!role) return message.reply('❌ Mentionne un rôle valide.');
    if (!reactionRolesData[messageId]) return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\`. Utilise \`!rr-list\`.`);
 
    const rrEntry = reactionRolesData[messageId];
    if (rrEntry.roles[emoji]) return message.reply(`⚠️ L'emoji ${emoji} est déjà utilisé. Retire-le avec \`!rr-remove ${messageId} | ${emoji}\``);
 
    try {
      const targetChannel = await client.channels.fetch(rrEntry.channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      await targetMessage.react(emoji);
      rrEntry.roles[emoji] = role.id;
      saveReactionRoles();
      await updateRREmbed(targetMessage, rrEntry);
      await message.reply(`✅ ${emoji} → <@&${role.id}> ajouté !`);
    } catch (err) {
      console.error('[RR-ADD] Erreur :', err.message);
      await message.reply(`❌ Erreur : ${err.message}`);
    }
  },
 
  '!rr-remove': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!rr-remove <messageID> | <emoji>`');
 
    const [messageId, emoji] = parts;
    if (!reactionRolesData[messageId]) return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\`.`);
    if (!reactionRolesData[messageId].roles[emoji]) return message.reply(`❌ L'emoji ${emoji} n'est pas configuré sur ce message.`);
 
    try {
      const targetChannel = await client.channels.fetch(reactionRolesData[messageId].channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      const reaction = targetMessage.reactions.cache.find(r => r.emoji.name === emoji);
      if (reaction) await reaction.remove();
      delete reactionRolesData[messageId].roles[emoji];
      saveReactionRoles();
      await updateRREmbed(targetMessage, reactionRolesData[messageId]);
      await message.reply(`✅ Emoji ${emoji} retiré.`);
    } catch (err) {
      console.error('[RR-REMOVE] Erreur :', err.message);
      await message.reply(`❌ Erreur : ${err.message}`);
    }
  },
 
  '!rr-list': async (message) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const entries = Object.entries(reactionRolesData);
    if (entries.length === 0) return message.reply('ℹ️ Aucun message de reaction role configuré. Utilise `!rr-setup`.');
 
    const fields = entries.map(([msgId, data]) => ({
      name: `📌 "${data.titre}" — \`${msgId}\``,
      value: `Channel: <#${data.channelId}>\n${Object.entries(data.roles).map(([e, r]) => `${e} → <@&${r}>`).join('\n') || '*Aucun rôle*'}`,
      inline: false,
    }));
 
    await message.reply({ embeds: [embed('#7289DA').setTitle('🎭 Reaction Roles configurés').addFields(fields)] });
  },
 
  '!rr-delete': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const messageId = args[0];
    if (!messageId) return message.reply('❌ Format : `!rr-delete <messageID>`');
    if (!reactionRolesData[messageId]) return message.reply(`❌ Message introuvable avec l'ID \`${messageId}\`.`);
 
    try {
      const targetChannel = await client.channels.fetch(reactionRolesData[messageId].channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);
      await targetMessage.delete();
    } catch { console.warn('[RR-DELETE] Message déjà supprimé.'); }
 
    delete reactionRolesData[messageId];
    saveReactionRoles();
    await message.reply(`✅ Message de reaction role \`${messageId}\` supprimé.`);
  },
 
  // --- PUBMED ---
  '!pubmed': async (message) => {
    const fields = [{ name: '📄 Titre', value: studyData.title || 'Non défini', inline: false }];
    if (studyData.url) fields.push({ name: '🔗 Lien', value: studyData.url, inline: false });
    if (studyData.setBy) fields.push({ name: '👤 Définie par', value: `<@${studyData.setBy}>`, inline: true });
    if (studyData.setAt) fields.push({ name: '📅 Date', value: studyData.setAt, inline: true });
    await message.reply({ embeds: [embed('#00B5D8').setTitle('🔬 Dernière étude partagée').setDescription(studyData.description || 'Aucune description.').addFields(fields)] });
  },
 
  '!def-etude': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Tu n\'as pas la permission d\'utiliser cette commande.');
    const parts = args.join(' ').split('|').map(s => s.trim());
    if (parts.length < 2) return message.reply('❌ Format : `!def-etude <titre> | <url> | <description>`');
    studyData = { title: parts[0] || 'Sans titre', url: parts[1] || '', description: parts[2] || '', setBy: message.author.id, setAt: new Date().toLocaleDateString('fr-FR') };
    saveJSON(FILES.study, studyData);
    await message.reply(`✅ Étude mise à jour : **${studyData.title}**`);
  },
 
  // --- COPE / INTÉRESSANT ---
  '!cope': async (message) => {
    const copeList = copesData.cope.length > 0 ? copesData.cope.map((c, i) => `${i + 1}. ${c}`).join('\n') : '*Aucun complément dans cette liste.*';
    const interestingList = copesData.interesting.length > 0 ? copesData.interesting.map((c, i) => `${i + 1}. ${c}`).join('\n') : '*Aucun complément dans cette liste.*';
    await message.reply({ embeds: [embed('#FF6B6B').setTitle('💊 Liste des compléments').addFields(
      { name: '❌ COPE (Inutiles / À éviter)', value: copeList.slice(0, 1024), inline: false },
      { name: '✅ Intéressants / Utiles', value: interestingList.slice(0, 1024), inline: false },
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
    const idx = copesData.cope.indexOf(name);
    if (idx === -1) return message.reply(`❌ **${name}** introuvable dans la liste Cope.`);
    copesData.cope.splice(idx, 1); saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** retiré de la liste Cope.`);
  },
 
  '!remove-interesting': async (message, args) => {
    if (!isAdmin(message.author.id)) return message.reply('❌ Permission refusée.');
    const name = args.join(' ').trim();
    const idx = copesData.interesting.indexOf(name);
    if (idx === -1) return message.reply(`❌ **${name}** introuvable dans la liste Intéressants.`);
    copesData.interesting.splice(idx, 1); saveJSON(FILES.copes, copesData);
    await message.reply(`✅ **${name}** retiré de la liste Intéressants.`);
  },
 
  // --- RÈGLES ---
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
 
  // --- SOURCE ---
  '!source': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !source — CF : règle 1.');
      await message.reply({ embeds: [embed('#FFA500').setTitle('🔇 Mute automatique').setDescription(`<@${message.author.id}> a été muté pendant 10 minutes.\n\n**CF : règle 1.**`)] });
    } catch (err) { await message.reply(`❌ Impossible de muter : ${err.message}`); }
  },
 
  // --- MK677 ---
  '!mk677': async (message) => {
    if (isAdmin(message.author.id)) return;
    try {
      await message.member.timeout(10 * 60 * 1000, 'Utilisation de !mk677 — CF : règle 1.');
      await message.reply({ embeds: [embed('#FF4444').setTitle('🔇 Mute automatique (mk677)').setDescription(`<@${message.author.id}> a été muté pendant 10 minutes pour avoir mentionné le MK-677.\n\n**CF : règle 1.**`)] });
    } catch (err) { await message.reply(`❌ Impossible de muter : ${err.message}`); }
  },
 
  // --- BAN ---
  '!ban': async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Tu n\'as pas la permission de bannir des membres.');
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Mentionne un utilisateur à bannir : `!ban @user [raison]`');
    if (!target.bannable) return message.reply('❌ Je ne peux pas bannir cet utilisateur (rôle supérieur ou égal).');
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
    try {
      await target.ban({ reason: `${message.author.tag}: ${reason}`, deleteMessageSeconds: 604800 });
      await message.reply({ embeds: [embed('#FF4444').setTitle('🔨 Utilisateur banni').addFields(
        { name: 'Utilisateur', value: target.user.tag, inline: true },
        { name: 'Par', value: message.author.tag, inline: true },
        { name: 'Raison', value: reason, inline: false },
      )] });
    } catch (err) { await message.reply(`❌ Erreur lors du ban : ${err.message}`); }
  },
 
  // --- MOMMY ASMR ---
  '!mommy-asmr': async (message) => {
    if (!CONFIG.MOMMY_ASMR_USER_IDS.includes(message.author.id)) return message.reply('❌ Tu n\'as pas la permission d\'utiliser cette commande.');
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
      await message.reply(`❌ La règle **${num}** n'existe pas. Utilisez \`!regles\` pour voir toutes les règles.`);
    }
    return;
  }
});
 
// ============================================================
//  🎭  REACTION ROLES (simple + multi)
// ============================================================
 
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }
 
  const msgId = reaction.message.id;
  const emojiName = reaction.emoji.name;
 
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;
  if (msgId === MESSAGE_ID && reaction.message.channel.id === CHANNEL_ID && emojiName === EMOJI) {
    try {
      const member = await reaction.message.guild.members.fetch(user.id);
      const role = reaction.message.guild.roles.cache.get(ROLE_ID);
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
      const role = reaction.message.guild.roles.cache.get(roleId);
      if (!role) return console.error(`[MULTI-RR] Rôle introuvable : ${roleId}`);
      await member.roles.add(role);
      console.log(`[MULTI-RR] Rôle "${role.name}" donné à ${user.tag}`);
    } catch (err) { console.error('[MULTI-RR] Erreur ajout rôle :', err.message); }
  }
});
 
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }
 
  const msgId = reaction.message.id;
  const emojiName = reaction.emoji.name;
 
  const { MESSAGE_ID, CHANNEL_ID, ROLE_ID, EMOJI } = CONFIG.REACTION_ROLE;
  if (msgId === MESSAGE_ID && reaction.message.channel.id === CHANNEL_ID && emojiName === EMOJI) {
    try {
      const member = await reaction.message.guild.members.fetch(user.id);
      const role = reaction.message.guild.roles.cache.get(ROLE_ID);
      if (!role) return;
      await member.roles.remove(role);
      console.log(`[REACTION ROLE] Rôle "${role.name}" retiré à ${user.tag}`);
    } catch (err) { console.error('[REACTION ROLE] Erreur :', err.message); }
    return;
  }
 
  if (reactionRolesData[msgId]) {
    const roleId = reactionRolesData[msgId].roles[emojiName];
    if (!roleId) return;
    try {
      const member = await reaction.message.guild.members.fetch(user.id);
      const role = reaction.message.guild.roles.cache.get(roleId);
      if (!role) return;
      await member.roles.remove(role);
      console.log(`[MULTI-RR] Rôle "${role.name}" retiré à ${user.tag}`);
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
      liveStatus.isLive = true;
      liveStatus.lastNotified = new Date().toISOString();
      saveJSON(FILES.liveStatus, liveStatus);
      const e = embed('#FF0050').setTitle('🔴 LIVE EN COURS !').setDescription(`**@${CONFIG.TIKTOK_USERNAME}** est en live sur TikTok !`)
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
//  🚀  DÉMARRAGE
// ============================================================
 
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`👑 Admins: ${CONFIG.ADMIN_IDS.join(', ')}`);
  console.log(`📺 Surveillance TikTok: @${CONFIG.TIKTOK_USERNAME}`);
  console.log(`📢 Channel live: ${CONFIG.LIVE_CHANNEL_ID}`);
  console.log(`🎭 Multi-RR chargés: ${Object.keys(reactionRolesData).length} message(s)`);
  console.log(`🎫 Ticket viewer role: ${ticketConfig.viewRoleId || 'non défini'}`);
  console.log(`🎫 Ticket staff role: ${ticketConfig.staffRoleId || 'non défini'}`);
  console.log(`🎫 Tickets actifs chargés: ${Object.keys(ticketsData).length}`);
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
