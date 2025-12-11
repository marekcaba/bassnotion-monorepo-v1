# Root Files Audit

## ✅ Files That Should Stay in Root

### Essential Config Files

- `.dockerignore` - Docker ignore patterns
- `.gitignore` - Git ignore patterns
- `.npmrc` - npm configuration
- `.prettierignore` - Prettier ignore patterns
- `.prettierrc` - Prettier configuration
- `.eslintrc.json` - ESLint configuration
- `.lintstagedrc.json` - Lint-staged configuration
- `commitlint.config.js` - Commit linting rules
- `tsconfig.json` - TypeScript configuration
- `tsconfig.base.json` - Base TypeScript configuration
- `vitest.config.ts` - Vitest test configuration
- `nx.json` - Nx workspace configuration
- `package.json` - Package manifest
- `pnpm-lock.yaml` - Lock file
- `pnpm-workspace.yaml` - Workspace configuration

### Documentation

- `README.md` - Project readme
- `CLAUDE.md` - AI assistant instructions

### Deployment & Build

- `ecosystem.config.cjs` - PM2 configuration
- `vercel.json` - Vercel deployment config
- `railway.json` - Railway deployment config
- `nixpacks.toml` - Nixpacks build config
- `Dockerfile.final` - Production Dockerfile
- `build.sh` - Main build script

### Environment

- `.env` - Environment variables (gitignored)

## 🚫 Files That Should Be Moved/Removed

### Fix Scripts → `scripts/fixes/`

- `fix_all_backend_syntax.cjs`
- `fix_backend_syntax.cjs`
- `fix-backend-comprehensive.cjs`
- `fix-backend-errors.js`
- `fix-backend-logging-simple.cjs`
- `fix-backend-syntax-errors.cjs`
- `fix-remaining-errors.cjs`
- `fix-structured-logging-errors.cjs`

### Test Files → Move to appropriate locations

- `test-soundfont.html` → `apps/frontend/public/test/`
- `test-transport-direct.js` → `scripts/tests/`
- `test-widget-audio.js` → `scripts/tests/`
- `test-xhr.html` → `apps/frontend/public/test/`

### Temporary Files → Delete

- `temp_fix.cjs`
- `temp_fix.js`
- `test_output.log`
- `non-null-assertion-fixes.log`

### Backup Files → Archive or delete

- `test-pages-backup-2025-08-30T11-01-32-969Z.json`
- `test-pages-backup-2025-08-30T11-01-45-432Z.json`
- `.eslintrc.json.backup`
- `.eslintrc.fast.json`

### Screenshots → Move to `docs/screenshots/`

- `daw-test-page.png`
- `exercise-page-debug.png`
- `homepage-mobile.png`

### Build Info → Delete (generated)

- `tsconfig.tsbuildinfo`

### Utility Scripts → Review

- `build-frontend.sh` - Might be redundant with build.sh
- `dev-manage.sh` - Check if still needed
- `verify-deployment.sh` - Check if still needed

### Other

- `mcp-server.js` - Check if this belongs in scripts/
- `config.toml` - Verify what this is for
- `ecosystem.config.json` - Duplicate of .cjs version?
- `rules-checklist.mdc` - Move to docs/ or bmad-agent/
- `.DS_Store` - macOS file, should be gitignored

## 🧹 Recommended Actions

1. **Create directories**:

   ```bash
   mkdir -p scripts/fixes scripts/tests docs/screenshots
   ```

2. **Move fix scripts**:

   ```bash
   mv fix*.js fix*.cjs scripts/fixes/
   ```

3. **Move test files**:

   ```bash
   mv test-*.html apps/frontend/public/test/
   mv test-*.js scripts/tests/
   ```

4. **Move screenshots**:

   ```bash
   mv *.png docs/screenshots/
   ```

5. **Clean up temp files**:

   ```bash
   rm temp_fix.* test_output.log non-null-assertion-fixes.log
   rm test-pages-backup-*.json
   ```

6. **Update .gitignore** to include:
   - `.DS_Store`
   - `*.tsbuildinfo`
   - `*.log`
   - `temp_*`
