FROM node:9.8.0-alpine

RUN npm install discord.js moment pad

COPY app.js dailies.json /

CMD [ "node", "/app.js" ]
