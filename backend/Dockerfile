FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with retry and increased timeout
RUN npm config set fetch-timeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --prefer-offline || npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
