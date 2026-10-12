'use strict';

const fs = require('fs');
const path = require('path');
const dataFile = path.join(__dirname, '..', 'data', 'levels.json');

function loadLevels() {
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return {}; }
}
function saveLevels(data) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const levelData = loadLevels();
global.levelData = levelData;

const levelSystemEnabled = false;

global.addXP = function () {
    return null;
};

module.exports = {
    commands: ['level', 'rank', 'xp', 'leaderboard', 'lb', 'levels'],
    description: 'XP leveling system is disabled by default on this fork.',
    usage: '.level | .leaderboard',
    permission: 'public',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, sender, contextInfo } = ctx;
        const target = sender || jid;
        const notice = '📊 *XP leveling is disabled by default on this fork.*\n\n' +
            'This bot is running in safe mode and will not track or award XP points until the feature is explicitly re-enabled.';

        return sock.sendMessage(jid, {
            text: notice,
            mentions: [target],
            contextInfo
        }, { quoted: message });
    }
};
