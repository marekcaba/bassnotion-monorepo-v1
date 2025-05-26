# Stage 1: Dependency Installation & Build
FROM node:20-alpine AS builder

# Force cache invalidation - timestamp: 2025-05-26-19:15
ARG CACHE_BUST=2025-05-26-19:15

# Set the working directory to /app
WORKDIR /app

# Copy pnpm-lock.yaml and package.json to leverage Docker caching for dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace package.json files so pnpm knows what dependencies to install
COPY apps/backend/package.json ./apps/backend/package.json
COPY libs/contracts/package.json ./libs/contracts/package.json

# Install pnpm
RUN npm install -g pnpm

# Install all monorepo dependencies, which will also set up workspace symlinks
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy the rest of the monorepo source code
COPY . .

# Create necessary directories for Nx
RUN mkdir -p /app/tmp /app/.nx/cache

# Set Nx environment variables for Docker
ENV NX_DAEMON=false
ENV NX_CACHE_DIRECTORY=/app/.nx/cache
ENV NX_CLOUD_ACCESS_TOKEN=""
ENV NX_SKIP_NX_CACHE=false

# Build the shared contracts library first using Nx
RUN npx nx build contracts --configuration=production

# Explicitly link workspace dependencies after build
RUN pnpm install --frozen-lockfile

# Verify contracts build output and workspace linking
RUN echo "=== Contracts build verification ===" && \
    ls -la libs/contracts/dist/ && \
    echo "=== Checking workspace symlink ===" && \
    ls -la node_modules/@bassnotion/contracts && \
    echo "=== Checking contracts package.json ===" && \
    cat libs/contracts/package.json && \
    echo "=== Checking if contracts types are accessible ===" && \
    cat libs/contracts/dist/src/index.d.ts

# Build the backend application using Nx from monorepo root
# Nx handles the monorepo context and module resolution correctly
RUN npx nx build backend --configuration=production

# Verify backend build output
RUN ls -la dist/apps/backend/ || echo "Backend dist not found"

# Stage 2: Production Runtime Image
FROM node:20-alpine AS runner

# Set the working directory
WORKDIR /app

# Install pnpm in runner stage
RUN npm install -g pnpm

# Copy package files for production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs/contracts/package.json ./libs/contracts/package.json
COPY apps/backend/package.json ./apps/backend/package.json

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy the built backend application from the builder stage
COPY --from=builder /app/dist/apps/backend ./dist/apps/backend

# Copy the built contracts library (needed for runtime imports)
COPY --from=builder /app/libs/contracts/dist ./libs/contracts/dist

# Environment variables
ENV NODE_ENV=production

# Expose the port your NestJS app listens on
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/apps/backend/main.js"] 