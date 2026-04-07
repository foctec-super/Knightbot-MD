/**
 * BOT MANAGER & SMART FORWARDER
 * Features: JID Extraction, Targeted Forwarding, Anti-Ban Jitter
 */

let activeIntervals = {};

const managerCommand = async (sock, chatId, senderId, text, message) => {
    const isOwnerOrSudo = require('../lib/isOwner');
    if (!(await isOwnerOrSudo(senderId, sock, chatId))) return;

    const args = text.split('|').map(a => a.trim());
    const command = args[0].toLowerCase(); // e.g., .getjids or .forward

    // --- FEATURE 1: GET GROUP JIDs ---
    // Usage: .getjids
    if (command === '.getjids') {
        const groups = await sock.groupFetchAllParticipating();
        let list = "📋 *Your Group JIDs:*\n\n";
        for (let id in groups) {
            list += `👥 *Name:* ${groups[id].subject}\n🆔 *ID:* ${id}\n\n`;
        }
        return await sock.sendMessage(chatId, { text: list });
    }

    // --- FEATURE 2: SMART TARGETED FORWARDER ---
    // Usage: (Reply to a message) .forward | jid1,jid2 | interval_ms
    if (command === '.forward') {
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) return await sock.sendMessage(chatId, { text: "❌ Reply to the message you want to forward!" });

        const targetJids = args[1]?.split(',') || [];
        const baseInterval = parseInt(args[2]) || 60000; // Default 1 min

        if (targetJids.length === 0) return await sock.sendMessage(chatId, { text: "❌ Specify at least one JID." });

        await sock.sendMessage(chatId, { text: `🚀 Forwarding started to ${targetJids.length} groups.` });

        const runForwardLoop = async () => {
            for (const jid of targetJids) {
                try {
                    // --- ANTI-BAN ALGORITHM ---
                    // 1. Random delay between groups (3-7 seconds)
                    const groupDelay = Math.floor(Math.random() * 4000) + 3000;
                    await new Promise(r => setTimeout(r, groupDelay));

                    // 2. Forward with "High Score" to look like a standard share
                    await sock.sendMessage(jid, { 
                        forward: { key: message.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: chatId },
                        contextInfo: { isForwarded: true, forwardingScore: 999 }
                    }, { quoted: message.message.extendedTextMessage.contextInfo.quotedMessage });

                } catch (e) { console.error(`Failed for ${jid}:`, e); }
            }

            // 3. Time Lapse Jitter (±10% of your chosen interval)
            const jitter = (Math.random() * 0.2 - 0.1) * baseInterval; 
            const nextRun = baseInterval + jitter;

            activeIntervals[chatId] = setTimeout(runForwardLoop, nextRun);
        };

        runForwardLoop();
    }

    // --- FEATURE 3: STOP ---
    if (command === '.stop') {
        clearTimeout(activeIntervals[chatId]);
        delete activeIntervals[chatId];
        await sock.sendMessage(chatId, { text: "🛑 All automated tasks stopped." });
    }
};

module.exports = managerCommand;
