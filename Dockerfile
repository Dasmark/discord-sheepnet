FROM node:9.8.0-alpine

USER node

RUN cd $HOME && npm install discord.js moment moment-timezone googleapis@25.* google-auth-library@0.* google-auth-library readline fs moment-round turndown pad --save

COPY app.js dailies.json /home/node/

CMD [ "/usr/local/bin/node", "/home/node/app.js" ]
