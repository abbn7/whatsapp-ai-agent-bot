const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const TelegramBot = require('node-telegram-bot-api');
const { getAIResponse } = require('./ai-agent');
const express = require('express');
const axios = require('axios');
require('dotenv').config({ path: 'config.env' });

const app = express();
const port = process.env.PORT || 3000;

// إعداد تليجرام
const tgBot = new TelegramBot("5984403789:AAG0N8ThL71h4mIxPuIb4F863OyZurWBM8A", { polling: false });
const chatId = "5322402925";

// إعداد واتساب
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-zygote',
            '--deterministic-mode',
            '--disable-features=IsolateOrigins,site-per-process',
            '--shm-size=3gb'
        ],
        executablePath: process.env.CHROME_PATH || null
    }
});

// متغير لحفظ حالة البوت
let isWhatsAppReady = false;

// إرسال QR لتليجرام
client.on('qr', (qr) => {
    console.log('QR Received, sending to Telegram...');
    qrcode.toBuffer(qr, (err, buffer) => {
        if (!err) {
            tgBot.sendPhoto(chatId, buffer, { caption: 'Scan this QR code to connect WhatsApp' });
        }
    });
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    tgBot.sendMessage(chatId, '🔐 تم تسجيل الدخول بنجاح! جاري تشغيل المحرك...');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    tgBot.sendMessage(chatId, '❌ فشل تسجيل الدخول: ' + msg);
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isWhatsAppReady = true;
    tgBot.sendMessage(chatId, '✅ البوت الآن متصل وشغال تمام على واتساب! أرسل أي رسالة في جروب Cs للتجربة.');
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    isWhatsAppReady = false;
    tgBot.sendMessage(chatId, '⚠️ تم فصل البوت من واتساب. السبب: ' + reason + '\nجاري محاولة إعادة الاتصال...');
    client.initialize();
});

client.on('message_create', async (msg) => {
    // استخدمنا message_create لضمان التقاط الرسائل حتى لو كانت من البوت نفسه أو في ظروف معينة
    try {
        const chat = await msg.getChat();
        const isGroup = chat.isGroup;
        const chatName = chat.name || "Unknown";
        const body = msg.body || "";

        // إرسال تنبيه لتليجرام للتشخيص (Debug)
        if (body.length > 0) {
            console.log(`[DEBUG] Message from ${chatName}: ${body}`);
            // سنرسل فقط أول 50 حرف لتليجرام للتأكد أن البوت "يسمع" الرسائل
            // tgBot.sendMessage(chatId, `🔍 استلمت رسالة من: ${chatName}\nالمحتوى: ${body.substring(0, 50)}...`);
        }

        // التحقق من الشرط: جروب Cs أو رسالة خاصة
        // قمنا بتحسين التحقق ليشمل الاسم أو المعرف
        const isTargetGroup = isGroup && (chatName.includes("Cs") || chat.id._serialized.includes("Cs"));
        const isPrivate = !isGroup;

        if (isTargetGroup || isPrivate) {
            // تجاهل الرسائل التي تبدأ بـ ! أو . إذا أردت (اختياري)
            if (msg.fromMe) return; // لا يرد على نفسه لتجنب اللوب

            await chat.sendStateTyping();
            const aiResponse = await getAIResponse(body);
            await msg.reply(aiResponse);
            console.log(`[SUCCESS] Replied to ${chatName}`);
        }
    } catch (error) {
        console.error('Error handling message:', error);
        // tgBot.sendMessage(chatId, `❌ خطأ في معالجة الرسالة: ${error.message}`);
    }
});

client.initialize();

// نظام Keep Alive
app.get('/', (req, res) => {
    res.send('WhatsApp AI Agent is Running!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    tgBot.sendMessage(chatId, '🚀 Server has started! Waiting for WhatsApp connection...');
});

// وظيفة لإبقاء السيرفر مستيقظاً
setInterval(() => {
    const url = process.env.APP_URL;
    if (url) {
        axios.get(url).catch(err => console.log('Keep-alive ping failed'));
    }
}, 5 * 60 * 1000); // كل 5 دقائق
