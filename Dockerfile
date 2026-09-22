# Use official Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy all project files
COPY . .

# Expose the port Cloud Run will use
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
