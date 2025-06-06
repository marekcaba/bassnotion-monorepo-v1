# BassNotion Technical Context

## Technology Stack Overview

### **Core Architecture**

- **Monorepo**: Nx workspace with pnpm for efficient package management
- **Language**: TypeScript 5.7.2 throughout entire stack
- **Module System**: ES Modules with NodeNext resolution
- **Build System**: Vite for frontend, Webpack for backend builds

### **Frontend Technology**

- **Framework**: Next.js 15.3.2 with App Router architecture
- **UI Library**: React 19.1.0 with concurrent features enabled
- **Component System**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**:
  - Zustand for client-side state
  - React Query (TanStack Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest + React Testing Library + Playwright

### **Backend Technology**

- **Framework**: NestJS with TypeScript decorators
- **Architecture**: Domain-driven design with modular structure
- **Database**: Supabase with PostgreSQL
- **Authentication**: Supabase Auth with JWT tokens
- **API Design**: RESTful with OpenAPI/Swagger documentation
- **Real-time**: WebSocket support for live features
- **Testing**: Vitest for unit/integration, custom e2e framework

### **Shared Infrastructure**

- **Type Safety**: Shared contracts library in `libs/contracts`
- **Database**: Supabase migrations and schema management
- **Process Management**: PM2 for production deployment
- **Code Quality**: ESLint + Prettier with custom configurations
- **CI/CD**: Automated testing and deployment pipeline

## Development Environment

### **Prerequisites**

- **Node.js**: 18+ (20+ recommended for optimal performance)
- **pnpm**: 8+ (10+ recommended) - **MANDATORY** package manager
- **TypeScript**: 5.7.2 (managed via project dependencies)
- **Git**: Latest version for version control

### **Project Setup**

```bash
# Install all dependencies
pnpm install

# Build all projects
pnpm nx run-many --target=build --all

# Start development servers
pnpm nx serve @bassnotion/frontend    # Frontend dev server
pnpm nx serve @bassnotion/backend     # Backend dev server
pnpm dev                              # Both servers in parallel
```

### **Key Scripts**

```bash
# Development
pnpm dev:frontend                     # Frontend only
pnpm dev:backend                      # Backend only
pnpm dev                              # Both applications

# Building
pnpm build:frontend                   # Frontend production build
pnpm build:backend                    # Backend production build
pnpm build                            # Full project build

# Testing
pnpm nx test @bassnotion/frontend     # Frontend unit tests
pnpm nx test @bassnotion/backend      # Backend unit tests
pnpm nx e2e frontend-e2e              # E2E tests

# Code Quality
pnpm lint                             # ESLint across all projects
pnpm lint:fix                         # Auto-fix linting issues
```

### **Import Rules (Critical)**

**MANDATORY Import Standards:**

1. **Relative Imports** (within same project):

   ```typescript
   // ✅ CORRECT - Must include .js extension
   import { Component } from './components/Component.js';
   import { utils } from '../utils/helpers.js';
   ```

2. **Alias Imports** (cross-project):

   ```typescript
   // ✅ CORRECT - Never include extension
   import { UserType } from '@bassnotion/contracts';
   import { Component } from '@/components/ui';
   ```

3. **Package Imports** (node_modules):
   ```typescript
   // ✅ CORRECT - Never include extension
   import React from 'react';
   import { z } from 'zod';
   ```

## Project Structure

### **Monorepo Organization**

```
bassnotion-monorepo-v1/
├── apps/
│   ├── backend/                    # NestJS API server
│   │   ├── src/domains/            # Domain-driven architecture
│   │   ├── supabase/               # Database migrations
│   │   └── e2e/                    # End-to-end tests
│   ├── frontend/                   # Next.js application
│   │   ├── src/app/                # App Router pages
│   │   ├── src/domains/            # Feature domains
│   │   └── src/shared/             # Shared components
│   └── frontend-e2e/               # Playwright tests
├── libs/
│   └── contracts/                  # Shared TypeScript types
├── memory-bank/                    # Project documentation
└── bmad-agent/                     # AI agent configurations
```

### **Domain Architecture**

Both frontend and backend follow consistent domain organization:

**Shared Domains:**

- **`user/`**: Authentication, profiles, user management
- **`learning/`**: Educational content, lessons, curricula
- **`playback/`**: Audio playback, analysis, practice tools
- **`content/`**: Content management, resources, metadata
- **`analysis/`**: Audio processing, performance analytics
- **`social/`**: Community features, sharing, collaboration
- **`widgets/`**: Reusable components, specialized tools

**Frontend-Specific:**

- **`playbook/`**: Practice session management and tools

## Technical Constraints

### **Performance Requirements**

- **Real-time Audio**: Sub-100ms latency for audio analysis feedback
- **Concurrent Users**: Support for multiple simultaneous practice sessions
- **Mobile Performance**: Responsive design with optimized mobile experience
- **Progressive Loading**: Chunked content delivery for large audio/video files

### **Browser Support**

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **WebAudio API**: Required for real-time audio processing features
- **WebRTC**: Optional for collaborative features

### **Security Considerations**

- **Authentication**: Supabase Auth with secure JWT handling
- **Data Protection**: GDPR compliance for user data
- **API Security**: Rate limiting and input validation
- **File Upload**: Secure handling of audio/video content
- **Content Moderation**: User-generated content safety measures

### **Deployment Configuration**

- **Production Build**: Optimized builds with tree-shaking and minification
- **Environment Variables**: Secure configuration management
- **Database Migrations**: Automated schema updates
- **CDN Integration**: Asset delivery optimization
- **Monitoring**: Error tracking and performance monitoring

## Development Workflow

### **Code Standards**

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Custom configuration with React and Node.js rules
- **Prettier**: Automated code formatting on save
- **Husky**: Pre-commit hooks for code quality validation
- **Import Organization**: Consistent import grouping and ordering

### **Testing Strategy**

- **Unit Tests**: Vitest for individual component/function testing
- **Integration Tests**: API endpoint and service integration
- **E2E Tests**: Playwright for complete user workflow validation
- **Test Coverage**: Minimum 80% coverage requirement
- **Visual Regression**: Automated UI consistency checking

### **Version Control**

- **Branch Strategy**: Feature branches with pull request reviews
- **Commit Convention**: Conventional commits for automated changelog
- **Release Process**: Automated versioning and deployment
- **Migration Management**: Database schema versioning

### **Performance Optimization**

- **Bundle Analysis**: Webpack bundle analyzer for size optimization
- **Code Splitting**: Dynamic imports for feature-based chunking
- **Asset Optimization**: Image compression and lazy loading
- **Caching Strategy**: Browser and CDN caching configuration
- **Core Web Vitals**: Performance monitoring and optimization

## Integration Points

### **External Services**

- **Supabase**: Database, authentication, real-time subscriptions
- **YouTube API**: External video content integration
- **Audio Processing**: Web Audio API for real-time analysis
- **File Storage**: Supabase Storage for audio/video files

### **API Architecture**

- **RESTful Design**: Standard HTTP methods and status codes
- **Type-Safe Contracts**: Shared types between frontend and backend
- **Error Handling**: Consistent error response structure
- **Rate Limiting**: API usage limits and throttling
- **Documentation**: OpenAPI/Swagger for API documentation

### **Real-time Features**

- **WebSocket Support**: Live collaboration and updates
- **Supabase Realtime**: Database change subscriptions
- **Audio Streaming**: Real-time audio processing and feedback
- **Presence System**: User online status and activity tracking

This technical foundation provides a scalable, maintainable, and performance-optimized platform for BassNotion's comprehensive bass learning experience.
