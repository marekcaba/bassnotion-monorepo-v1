# 🚨 MANDATORY ASSISTANT RULES CHECKLIST

**BEFORE ANY COMMAND OR CODE CHANGE, VERIFY:**

## ✅ **PACKAGE MANAGER CHECK**

- [ ] ✅ CONFIRMED: This is a **pnpm project** (pnpm-lock.yaml exists)
- [ ] ❌ NEVER use: npm, yarn commands

## ✅ **IMPORT RULES CHECK**

- [ ] ✅ Relative imports (./ or ../) → MUST include .js extension
- [ ] ✅ Alias imports (@/ or @bassnotion/) → NEVER include .js extension
- [ ] ✅ Package imports → NEVER include extensions

## ✅ **TECHNOLOGY STACK CHECK**

- [ ] ✅ NX Monorepo (nx.json exists)
- [ ] ✅ Build tool: Vite (vite.config.ts)
- [ ] ✅ Testing: Vitest (not Jest)
- [ ] ✅ Process manager: PM2
- [ ] ✅ TypeScript with NodeNext module resolution

## ✅ **PERMISSION CHECK**

- [ ] ✅ Asked permission before code changes
- [ ] ✅ Asked permission before layout changes

---

## 🚨 **MANDATORY COMMANDS**

### ✅ **CORRECT COMMANDS:**

```bash
# Package management
pnpm install
pnpm run build
pnpm audit

# NX build commands
pnpm nx build @bassnotion/backend
pnpm nx build @bassnotion/frontend

# NX test commands
pnpm nx test @bassnotion/backend                    # Run all backend tests
pnpm nx test @bassnotion/backend [test-file-name]   # Run specific test file
pnpm nx test @bassnotion/frontend                   # Run all frontend tests

# Development commands (NX serve for dev)
pnpm nx serve @bassnotion/backend                   # Start backend dev server
pnpm nx serve @bassnotion/frontend                  # Start frontend dev server

# PM2 commands (Production/Server management)
pm2 start ecosystem.config.js                      # Start all servers via PM2
pm2 stop all                                       # Stop all PM2 processes
pm2 restart all                                    # Restart all PM2 processes
pm2 status                                         # Check PM2 process status
pm2 logs                                           # View PM2 logs
pm2 logs [process-name]                            # View specific process logs
```

### ❌ **FORBIDDEN COMMANDS:**

```bash
# NEVER use these:
npm install        # ❌
npm run build      # ❌
npm run test       # ❌
yarn install       # ❌
jest               # ❌ (use Vitest via NX)
```

---

## 🧪 **TESTING RULES**

### ✅ **CORRECT TEST COMMANDS:**

```bash
# Run all tests for a project
pnpm nx test @bassnotion/backend

# Run specific test file
pnpm nx test @bassnotion/backend auth-security.integration.spec.ts

# Run tests with coverage
pnpm nx test @bassnotion/backend --coverage

# Run tests in watch mode
pnpm nx test @bassnotion/backend --watch
```

### ⚠️ **TEST REQUIREMENTS:**

- Tests use **Vitest** (not Jest)
- Integration tests require database setup
- Tests may need `.env.test` file with proper Supabase credentials
- Tests run in parallel - each test should be isolated

---

## 🔍 **VERIFICATION QUESTIONS I MUST ASK MYSELF:**

1. **"Is this a pnpm project?"** → Check for pnpm-lock.yaml
2. **"What import rules apply?"** → Check file path type (relative vs alias)
3. **"Do I have permission?"** → Ask user before changes
4. **"Is this the correct command?"** → Verify against rules
5. **"Am I using the right test command?"** → Use `pnpm nx test` not `npm test`
6. **"Should I use PM2 or NX serve?"** → PM2 for production, NX serve for development

---

**IF I VIOLATE THESE RULES, STOP AND CORRECT IMMEDIATELY!** 🛑
