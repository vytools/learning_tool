FROM node:20-alpine
COPY ./package.json /usr/app/package.json
WORKDIR /usr/app
RUN npm install