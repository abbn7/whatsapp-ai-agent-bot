const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const TelegramBot = require('node-telegram-bot-api');
const { getAIResponse } = require('./ai-agent');
const express = require('express');
const axios = require('axios');
require('dotenv').config({ path: 'config.env' });

// إعدادات تليجرام المباشرة
const TELEGRAM_TOKEN = "5984403789:AAG0N8ThL71h4mIxPuIb4F863OyZurWBM8A";
const TELEGRAM_CHAT_ID = "5322402925";
const tgBot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const app = express();
const port = process.env.PORT || 8080;

let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        executablePath: process.env.CHROME_PATH || '/usr/bin/chromium'
    }
});

// معالجة الـ QR
client.on('qr', (qr) => {
    if (isReady) return;
    console.log("New QR Received");
    qrcode.toBuffer(qr, (err, buffer) => {
        if (!err) {
            tgBot.sendPhoto(TELEGRAM_CHAT_ID, buffer, { 
                caption: '⚠️ امسح الـ QR للربط بنظام الواتساب الجديد.\nالبوت جاهز للعمل فور المسح.' 
            });
        }
    });
});

// عند نجاح التوثيق
client.on('authenticated', () => {
    console.log("Authenticated successfully!");
    tgBot.sendMessage(TELEGRAM_CHAT_ID, "🔐 تم التوثيق بنجاح! جاري تشغيل البوت...");
});

// عندما يكون البوت جاهزاً تماماً
client.on('ready', async () => {
    isReady = true;
    console.log("WhatsApp Bot is Ready!");
    tgBot.sendMessage(TELEGRAM_CHAT_ID, "✅ البوت متصل الآن وشغال 100%.\nجرب إرسال رسالة في جروب Cs.");
    
    try {
        await client.sendMessage(client.info.wid._serialized, "🚀 البوت متصل ومستقر الآن وجاهز للرد.");
    } catch (e) {}
});

// معالجة الرسائل
client.on('message_create', async (msg) => {
    try {
        if (!msg.body) return;
        const chat = await msg.getChat();
        const chatName = chat.name || "Unknown";
        const body = msg.body;

        if (msg.fromMe) {
            if (body === "!test") await msg.reply("النظام مستقر والاستجابة سريعة! ✅");
            return;
        }

        const isCsGroup = chat.isGroup && (chatName.toLowerCase().includes("cs") || chat.id._serialized.includes("cs"));
        const isPrivate = !chat.isGroup;

        if (isCsGroup || isPrivate) {
            console.log(`[INCOMING] From: ${chatName} | Message: ${body}`);
            tgBot.sendMessage(TELEGRAM_CHAT_ID, `📩 من [${chatName}]: ${body.substring(0, 100)}`);

            await chat.sendStateTyping();
            const aiResponse = await getAIResponse(body);
            await msg.reply(aiResponse);
            console.log(`[SUCCESS] Replied to ${chatName}`);
        }
    } catch (error) {
        console.error("Message Error:", error);
    }
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log("Disconnected:", reason);
    tgBot.sendMessage(TELEGRAM_CHAT_ID, "⚠️ انفصل البوت: " + reason + "\nجاري إعادة التشغيل...");
    client.initialize();
});

client.initialize();

app.get('/', (req, res) => res.send('WhatsApp AI Agent is Running...'));
app.listen(port, () => console.log(`HTTP Server listening on port ${port}`));

setInterval(() => {
    if (process.env.APP_URL) {
        axios.get(process.env.APP_URL).catch(() => {});
    }
}, 300000);
