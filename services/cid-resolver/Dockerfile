FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/cid-resolver/package*.json ./
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY services/cid-resolver/ ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start service
CMD ["npm", "start"]
