FROM node:9.8.0-alpine

RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Europe/Berlin /etc/localtime && \
    echo 'Europe/Berlin' > /etc/timezone && \
    apk del tzdata

USER node

RUN cd $HOME && npm install discord.js moment moment-timezone chrono-node googleapis@25.* google-auth-library@0.* readline fs moment-round turndown pad --save

COPY app.js lib.js dailies.json /home/node/

CMD [ "/usr/local/bin/node", "/home/node/app.js" ]
