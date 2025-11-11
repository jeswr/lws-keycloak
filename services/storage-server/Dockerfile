FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/storage-server/package*.json ./
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY services/storage-server/ ./

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /data/storage

# Expose port
EXPOSE 3001

# Start service
CMD ["npm", "start"]
