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
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isWhatsAppReady = true;
    tgBot.sendMessage(chatId, '✅ WhatsApp Bot is now ONLINE and ready to serve!');
});

client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        
        // التحقق إذا كانت الرسالة من الجروب المطلوب أو شات خاص
        if (chat.name === "Cs" || !chat.isGroup) {
            console.log(`Message from ${chat.name}: ${msg.body}`);
            
            // إظهار حالة "يكتب الآن"
            await chat.sendStateTyping();
            
            const aiResponse = await getAIResponse(msg.body);
            await msg.reply(aiResponse);
        }
    } catch (error) {
        console.error('Error handling message:', error);
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
