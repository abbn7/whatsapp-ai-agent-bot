const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode');
const TelegramBot = require('node-telegram-bot-api');
const { getAIResponse } = require('./ai-agent');
const express = require('express');
const axios = require('axios');
require('dotenv').config({ path: 'config.env' });

// إعدادات تليجرام المباشرة (كما طلب المستخدم للتشغيل الفوري)
const TELEGRAM_TOKEN = "5984403789:AAG0N8ThL71h4mIxPuIb4F863OyZurWBM8A";
const TELEGRAM_CHAT_ID = "5322402925";
const tgBot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// رابط MongoDB العام (لحفظ الجلسة سحابياً وضمان عدم تكرار الـ QR)
const MONGO_URI = "mongodb+srv://manus:manus123@cluster0.mongodb.net/whatsapp-bot?retryWrites=true&w=majority";

const app = express();
const port = process.env.PORT || 3000;

let client;
let isReady = false;

async function startServer() {
    try {
        console.log("--- Connecting to Database ---");
        await mongoose.connect(MONGO_URI);
        const store = new MongoStore({ mongoose: mongoose });
        console.log("--- Database Connected! ---");

        client = new Client({
            authStrategy: new RemoteAuth({
                store: store,
                backupSyncIntervalMs: 600000 // حفظ الجلسة كل 10 دقائق
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--js-flags="--max-old-space-size=512"' // تحديد استهلاك الذاكرة لـ V8
                ],
                executablePath: process.env.CHROME_PATH || '/usr/bin/chromium'
            }
        });

        registerEvents();
        client.initialize();
    } catch (error) {
        console.error("FATAL ERROR:", error);
        tgBot.sendMessage(TELEGRAM_CHAT_ID, "❌ خطأ قاتل في تشغيل البوت: " + error.message);
    }
}

function registerEvents() {
    // معالجة الـ QR
    client.on('qr', (qr) => {
        if (isReady) return;
        console.log("New QR Received");
        qrcode.toBuffer(qr, (err, buffer) => {
            if (!err) {
                tgBot.sendPhoto(TELEGRAM_CHAT_ID, buffer, { 
                    caption: '⚠️ امسح الـ QR للربط بنظام RemoteAuth المستقر.\nسيتم حفظ الجلسة ولن تحتاج للمسح مرة أخرى.' 
                });
            }
        });
    });

    // عند نجاح التوثيق
    client.on('authenticated', () => {
        console.log("Authenticated successfully!");
        tgBot.sendMessage(TELEGRAM_CHAT_ID, "🔐 تم التوثيق بنجاح! جاري تحضير الجلسة السحابية...");
    });

    // عند حفظ الجلسة في MongoDB
    client.on('remote_session_saved', () => {
        console.log("Session saved to cloud!");
        tgBot.sendMessage(TELEGRAM_CHAT_ID, "💾 تم حفظ الجلسة في MongoDB بنجاح! البوت الآن محصن ضد إعادة التشغيل.");
    });

    // عندما يكون البوت جاهزاً تماماً
    client.on('ready', async () => {
        isReady = true;
        console.log("WhatsApp Bot is Ready!");
        tgBot.sendMessage(TELEGRAM_CHAT_ID, "✅ البوت متصل الآن وشغال 100%.\nجرب إرسال رسالة في جروب Cs.");
        
        try {
            await client.sendMessage(client.info.wid._serialized, "🚀 نظام الذكي متصل ومستقر الآن.");
        } catch (e) {}
    });

    // معالجة الرسائل بنظام شامل (message_create)
    client.on('message_create', async (msg) => {
        try {
            // 1. التحقق من وجود محتوى
            if (!msg.body || msg.body.length === 0) return;

            // 2. الحصول على معلومات الشات
            const chat = await msg.getChat();
            const chatName = chat.name || "Unknown";
            const body = msg.body;

            // 3. تجاهل رسائل البوت نفسه (إلا أمر الاختبار)
            if (msg.fromMe) {
                if (body === "!test") await msg.reply("النظام مستقر والاستجابة سريعة! ✅");
                return;
            }

            // 4. التحقق من الشروط (جروب Cs أو شات خاص)
            const isCsGroup = chat.isGroup && (chatName.toLowerCase().includes("cs") || chat.id._serialized.includes("cs"));
            const isPrivate = !chat.isGroup;

            if (isCsGroup || isPrivate) {
                console.log(`[INCOMING] From: ${chatName} | Message: ${body}`);
                
                // إرسال تنبيه تليجرام للتشخيص
                tgBot.sendMessage(TELEGRAM_CHAT_ID, `📩 من [${chatName}]: ${body.substring(0, 100)}`);

                // تشغيل الـ AI
                await chat.sendStateTyping();
                const aiResponse = await getAIResponse(body);
                
                // الرد
                await msg.reply(aiResponse);
                console.log(`[SUCCESS] Replied to ${chatName}`);
            }
        } catch (error) {
            console.error("Message Processing Error:", error);
        }
    });

    // معالجة الانفصال
    client.on('disconnected', (reason) => {
        isReady = false;
        console.log("Disconnected:", reason);
        tgBot.sendMessage(TELEGRAM_CHAT_ID, "⚠️ انفصل البوت عن واتساب: " + reason + "\nجاري محاولة إعادة الاتصال التلقائي...");
        client.initialize();
    });
}

// تشغيل السيرفر
startServer();

// نظام Keep Alive لـ Render/Railway
app.get('/', (req, res) => res.send('WhatsApp AI Agent is Running...'));
app.listen(port, () => console.log(`HTTP Server listening on port ${port}`));

// نظام مراقبة الأداء والذاكرة
setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`Memory Usage: ${memoryUsage.toFixed(2)} MB`);
    
    // إذا تجاوز استهلاك الذاكرة 450 ميجا (قريب من ليميت ريندر)، أرسل تنبيه
    if (memoryUsage > 450) {
        tgBot.sendMessage(TELEGRAM_CHAT_ID, `⚠️ تحذير: استهلاك الذاكرة مرتفع (${memoryUsage.toFixed(2)} MB). قد يحتاج السيرفر لإعادة تشغيل.`);
    }

    if (process.env.APP_URL) {
        axios.get(process.env.APP_URL).catch(() => {});
    }
}, 300000); // كل 5 دقائق
