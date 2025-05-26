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

# Build the shared contracts library first
RUN npx nx build @bassnotion/contracts --configuration=production

# Build the backend application
RUN npx nx build @bassnotion/backend --configuration=production

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
COPY --from=builder /app/dist/libs/contracts ./dist/libs/contracts

# Environment variables
ENV NODE_ENV=production

# Expose the port your NestJS app listens on
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/apps/backend/main.js"] 