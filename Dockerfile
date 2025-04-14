FROM node:22

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm ci --omit=dev

# Bundle app source
COPY . .

RUN rm -rf dist
RUN mkdir -p dist

RUN npx tsc --build --force --verbose

RUN echo build done

CMD [ "node", "dist/app.js" ]
