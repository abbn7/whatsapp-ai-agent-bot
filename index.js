const TelegramBot = require('node-telegram-bot-api');
const { getAIResponse } = require('./ai-agent');
const express = require('express');
const axios = require('axios');
require('dotenv').config({ path: 'config.env' });

// إعدادات تليجرام (التوكن الخاص بك)
const TELEGRAM_TOKEN = "5984403789:AAG0N8ThL71h4mIxPuIb4F863OyZurWBM8A";
const tgBot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const app = express();
const port = process.env.PORT || 8080;

console.log("--- Telegram AI Agent Bot is Starting ---");

// إرسال رسالة ترحيب عند التشغيل
tgBot.sendMessage("5322402925", "🚀 تم تشغيل بوت التليجرام الذكي بنجاح!\nأنا الآن جاهز للرد على رسائلك باستخدام نماذج Groq الثلاثة.");

// استقبال الرسائل ومعالجتها
tgBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // تجاهل الرسائل الفارغة أو الأوامر (إلا البداية)
    if (!text) return;
    if (text === '/start') {
        return tgBot.sendMessage(chatId, "أهلاً بك! أنا بوت ذكاء اصطناعي متطور. أرسل أي سؤال وسأقوم بالتفكير فيه بعمق والرد عليك.");
    }

    console.log(`[INCOMING] From: ${chatId} | Message: ${text}`);

    try {
        // إظهار حالة "جاري الكتابة"
        await tgBot.sendChatAction(chatId, 'typing');

        // الحصول على رد الذكاء الاصطناعي (Agent Thinking)
        const aiResponse = await getAIResponse(text);

        // إرسال الرد
        await tgBot.sendMessage(chatId, aiResponse, { reply_to_message_id: msg.message_id });
        console.log(`[SUCCESS] Replied to ${chatId}`);
    } catch (error) {
        console.error("Error processing message:", error);
        tgBot.sendMessage(chatId, "عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى لاحقاً.");
    }
});

// نظام Keep Alive لـ Render/Railway
app.get('/', (req, res) => res.send('Telegram AI Agent is Running...'));
app.listen(port, () => console.log(`HTTP Server listening on port ${port}`));

// نظام Ping الذاتي لمنع النوم
setInterval(() => {
    if (process.env.APP_URL) {
        axios.get(process.env.APP_URL).catch(() => {});
    }
}, 300000); // كل 5 دقائق
