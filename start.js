require('dotenv').config();
const { spawn } = require('child_process');

console.log('Starting Gacha Cup (server + bot)...');

const server = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });
const bot = spawn('node', ['bot.js'], { stdio: 'inherit', shell: true });

function shutdown() {
    server.kill();
    bot.kill();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
