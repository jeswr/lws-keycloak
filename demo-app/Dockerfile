FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY demo-app/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY demo-app/ .

# Expose port
EXPOSE 3002

# Start the application
CMD ["npm", "run", "dev"]
