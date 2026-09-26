FROM node:16-alpine

ENV APP_HOME="/app"

# Create app directory
WORKDIR ${APP_HOME}

# Install dependencies first (own layer, cached until the lockfile changes)
COPY package.json package-lock.json ${APP_HOME}/
RUN npm config set strict-ssl false
RUN npm ci

# Bundle app source
COPY public/ ${APP_HOME}/public
COPY src/ ${APP_HOME}/src
COPY .env ${APP_HOME}/

# Expose the port
EXPOSE 3000
# Run the app
CMD ["npm", "start"]
