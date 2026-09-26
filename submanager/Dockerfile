# -------------------------------
# Subfleet Manager Dockerfile
# -------------------------------

# 1. Use official Node.js LTS base image
FROM node:22-alpine AS base

# 2. Set working directory
WORKDIR /app

# 3. Copy package.json and package-lock.json first (for better caching)
COPY package*.json ./

# 4. Install only production dependencies (omit dev deps for smaller image)
RUN npm ci --only=production

# 5. Copy the application source code
COPY . .

# 6. Set default environment variables
ENV MQTT_BROKER_URL="mqtt://localhost:1883" \
    SUBSCRIBE_TOPIC="no.sintef.sct.giot.things/downstream" \    
    DOCKER_PORT=2375 \
    NODE_ENV=production

# 7. Expose no ports (since this app acts as MQTT client, not a server)
# EXPOSE 1883

# 8. Run the application
CMD ["node", "./src/submanager.js"]
