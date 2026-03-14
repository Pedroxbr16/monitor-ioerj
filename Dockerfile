FROM mcr.microsoft.com/playwright:v1.51.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN npx playwright install chromium

COPY . .

EXPOSE 3081

CMD ["node", "server.js"]
