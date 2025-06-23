# Multi-stage build for Healthcare Management Application
# Optimized for cloud deployment with minimal image size

# Build stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Remove development files
RUN rm -rf tests/ .git* .eslintrc* .prettier* nodemon*

# Final stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create app directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/tmp && \
    chown -R nodejs:nodejs /app

# Install production dependencies
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package*.json /app/
COPY --from=build /app/src /app/src
COPY --from=build /app/config /app/config
COPY --from=build /app/server.js /app/server.js

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://localhost:8080/api/health/liveness || exit 1

# Start application
CMD ["node", "server.js"]