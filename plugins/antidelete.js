'use strict';

const config = require('../config');

function getOwnerJid() {
    const raw = (process.env.OWNER_NUMBER || config.OWNER_NUMBER || '').trim();
    const num = raw.replace(/\D/g, '');
    return num ? `${num}@s.whatsapp.net` : null;
}

function describeMessageContent(msg) {
    if (!msg) return '[empty]';
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return `[Image] ${msg.imageMessage.caption}`;
    if (msg.videoMessage?.caption) return `[Video] ${msg.videoMessage.caption}`;
    if (msg.audioMessage) return '[Audio]';
    if (msg.documentMessage?.fileName) return `[Document] ${msg.documentMessage.fileName}`;
    if (msg.stickerMessage) return '[Sticker]';
    if (msg.contactMessage) return '[Contact]';
    if (msg.locationMessage) return '[Location]';
    if (msg.liveLocationMessage) return '[Live location]';
    const keys = Object.keys(msg);
    return keys.length ? `[${keys[0]}]` : '[Unknown media]';
}

module.exports = {
    commands: ['antidelete', 'antidel'],
    description: 'Toggle anti-delete — recovers deleted and edited messages and forwards them to you',
    permission: 'owner',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { safeSend, contextInfo } = ctx;
        const action = (args[0] || '').toLowerCase();

        if (action === 'on') {
            config.ANTIDELETE_GROUP = true;
            config.ANTIDELETE_PRIVATE = true;
            await safeSend({
                text: '🛡️ *Anti-Delete is ON*\n\nDeleted and edited messages will be recovered and forwarded to you in both groups and private chats.',
                contextInfo
            }, { quoted: message });
        } else if (action === 'off') {
            config.ANTIDELETE_GROUP = false;
            config.ANTIDELETE_PRIVATE = false;
            await safeSend({ text: '🛡️ *Anti-Delete is OFF*', contextInfo }, { quoted: message });
        } else {
            const groupStatus = config.ANTIDELETE_GROUP ? '✅ ON' : '❌ OFF';
            const privateStatus = config.ANTIDELETE_PRIVATE ? '✅ ON' : '❌ OFF';
            await safeSend({
                text: `🛡️ *Anti-Delete Status*\n\n📌 Groups: ${groupStatus}\n📌 Private: ${privateStatus}\n\n*Usage:*\n• \`.antidelete on\` — enable\n• \`.antidelete off\` — disable`,
                contextInfo
            }, { quoted: message });
        }
    }
};

// Bind once per connection so deleted/edited messages are forwarded to the owner DM.
global.setupAntiDelete = function setupAntiDelete(sock) {
    if (!sock?.ev || global.__silvaAntiDeleteBound) return;
    global.__silvaAntiDeleteBound = true;

    sock.ev.on('messages.upsert', async ({ messages = [] }) => {
        const ownerJid = getOwnerJid();
        if (!ownerJid) return;

        for (const msg of messages) {
            const protocol = msg?.message?.protocolMessage;
            if (!protocol || !protocol.key) continue;

            const chatJid = msg?.key?.remoteJid;
            if (!chatJid) continue;

            const isGroup = String(chatJid).endsWith('@g.us');
            if ((isGroup && !config.ANTIDELETE_GROUP) || (!isGroup && !config.ANTIDELETE_PRIVATE)) continue;

            try {
                const type = protocol.type;
                if (type !== 0 && type !== 1) continue;

                const source = msg?.key?.participant || chatJid;
                const sourceNum = String(source).split('@')[0].replace(/\D/g, '') || 'Unknown';
                const original = await sock.loadMessage(chatJid, protocol.key).catch(() => null);
                const content = (original?.message && describeMessageContent(original.message))
                    || (protocol.editedMessage && describeMessageContent(protocol.editedMessage))
                    || '[Unable to recover message content]';

                const header = type === 0 ? '🗑️ *Deleted Message*' : '✏️ *Edited Message*';
                const lines = [
                    header,
                    '',
                    `📌 Chat: ${chatJid}`,
                    `👤 From: @${sourceNum}`,
                    '',
                    '💬 Message:',
                    content
                ];

                await sock.sendMessage(ownerJid, { text: lines.join('\n') });
            } catch (err) {
                console.error('[AntiDelete]', err.message);
            }
        }
    });
};
