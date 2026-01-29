FROM node:20-slim

# تثبيت التبعيات اللازمة لـ Chromium بشكل كامل لضمان الاستقرار
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# إعداد متغيرات البيئة لـ Puppeteer لتجنب تحميل Chromium مرتين
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

# تشغيل البوت باستخدام node مباشرة لتقليل استهلاك الذاكرة
CMD ["node", "index.js"]
