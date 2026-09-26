FROM node:16-alpine

ENV APP_HOME="/app"

# Create app directory
WORKDIR ${APP_HOME}

# Install dependencies first (own layer, cached until the lockfile changes)
COPY package.json package-lock.json ${APP_HOME}/
RUN npm config set strict-ssl false
RUN npm ci

# Bundle app source
COPY resources/ ${APP_HOME}/resources
COPY src/ ${APP_HOME}/src

EXPOSE 4000
CMD ["npm", "start"]
