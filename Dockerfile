# Stage 1: Dependency Installation & Build
FROM node:20-alpine AS builder

# Set the working directory to /app
WORKDIR /app

# Copy pnpm-lock.yaml and package.json to leverage Docker caching for dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install all monorepo dependencies, which will also set up workspace symlinks
RUN pnpm install --frozen-lockfile

# Copy the rest of the monorepo source code
COPY . .

# Create necessary directories for Nx
RUN mkdir -p /app/tmp /app/.nx/cache

# Set Nx environment variables for Docker
ENV NX_DAEMON=false
ENV NX_CACHE_DIRECTORY=/app/.nx/cache
ENV NX_CLOUD_ACCESS_TOKEN=""
ENV NX_REJECT_UNKNOWN_LOCAL_CACHE=0
ENV NX_SKIP_NX_CACHE=false

# Build the shared contracts library first using direct TypeScript compilation
WORKDIR /app/libs/contracts
RUN pnpm build
WORKDIR /app

# Verify contracts build output
RUN ls -la libs/contracts/dist/ || echo "Contracts dist not found"

# Debug: Check if dependencies are accessible
RUN echo "Checking node_modules structure..." && \
    ls -la node_modules/@nestjs/ | head -10 && \
    echo "Checking backend node_modules..." && \
    ls -la apps/backend/node_modules/ 2>/dev/null || echo "No backend node_modules" && \
    echo "Checking if TypeScript can find @nestjs/common..." && \
    node -e "console.log(require.resolve('@nestjs/common'))" || echo "Cannot resolve @nestjs/common"

# Build the backend application using TypeScript project references
RUN echo "Building backend with TypeScript..." && \
    mkdir -p dist/apps/backend && \
    npx tsc --build apps/backend/tsconfig.json --verbose

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