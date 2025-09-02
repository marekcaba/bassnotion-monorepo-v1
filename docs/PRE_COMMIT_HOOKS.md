# Pre-commit Hooks Setup

## Overview

BassNotion uses Git hooks to ensure code quality and consistency before commits and pushes. The following hooks are configured:

1. **Pre-commit**: Runs linting and formatting on staged files
2. **Commit-msg**: Ensures commit messages follow conventional commit format
3. **Pre-push**: Runs tests before pushing to remote

## Installation

The hooks are automatically installed when you run `pnpm install` in the project root.

## Pre-commit Hook

The pre-commit hook runs `lint-staged` which:

- Runs ESLint with auto-fix on JavaScript/TypeScript files
- Formats code with Prettier
- Only processes staged files for efficiency

### Configuration

Lint-staged configuration is in `.lintstagedrc.json`:

```json
{
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "*.css": [
    "prettier --write"
  ],
  "package.json": [
    "prettier --write"
  ]
}
```

## Commit Message Hook

Uses `commitlint` to enforce conventional commit format.

### Valid Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI configuration changes
- `chore`: Other changes that don't modify src or test files
- `revert`: Revert a previous commit
- `wip`: Work in progress

### Examples

✅ Valid commit messages:
```
feat: add user authentication
fix: resolve memory leak in audio player
docs: update API documentation
test: add unit tests for exercises service
```

❌ Invalid commit messages:
```
Added new feature
fix
Updated code
WIP
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: Required, must be one of the valid types
- **scope**: Optional, component or file affected
- **subject**: Required, short description (imperative mood)
- **body**: Optional, detailed explanation
- **footer**: Optional, breaking changes or issue references

Example with all parts:
```
feat(auth): add JWT refresh token support

Implemented automatic token refresh to improve user experience.
Tokens are refreshed 5 minutes before expiration.

Closes #123
```

## Pre-push Hook

Runs tests before allowing push to remote repository.

The hook executes `pnpm test:ci` which runs all tests in CI mode.

## Bypassing Hooks

In emergency situations, you can bypass hooks:

```bash
# Bypass pre-commit hook
git commit --no-verify -m "emergency: fix critical bug"

# Bypass pre-push hook
git push --no-verify
```

⚠️ **Use with caution!** Bypassing hooks should only be done in emergencies.

## Troubleshooting

### Hooks not running

1. Check if husky is installed:
   ```bash
   ls -la .husky/
   ```

2. Reinstall hooks:
   ```bash
   pnpm exec husky install
   ```

### ESLint errors blocking commit

1. Fix errors manually:
   ```bash
   pnpm lint:fix
   ```

2. If errors persist, check specific files:
   ```bash
   pnpm eslint path/to/file.ts
   ```

### Commitlint rejecting valid commits

Check the exact error and ensure:
- Type is valid (lowercase)
- No period at end of subject
- Subject is not empty
- Subject is not sentence case

### Tests failing on push

1. Run tests locally first:
   ```bash
   pnpm test
   ```

2. Fix failing tests before pushing

3. If tests pass locally but fail in hook, check for:
   - Environment differences
   - Missing test dependencies
   - Timing issues in async tests

## Customization

### Adding new file types to lint-staged

Edit `.lintstagedrc.json`:

```json
{
  "*.sql": [
    "sql-formatter --config .sql-formatter.json"
  ]
}
```

### Modifying commit types

Edit `commitlint.config.js` to add/remove types:

```javascript
'type-enum': [
  2,
  'always',
  [
    'feat',
    'fix',
    // Add new types here
    'security',
    'deprecate'
  ]
]
```

### Disabling specific hooks

To temporarily disable a hook, rename it:

```bash
mv .husky/pre-commit .husky/pre-commit.disabled
```

To re-enable:

```bash
mv .husky/pre-commit.disabled .husky/pre-commit
```

## Best Practices

1. **Keep commits small and focused** - easier to review and revert
2. **Write meaningful commit messages** - helps with debugging and changelog
3. **Fix linting errors immediately** - don't let them accumulate
4. **Run tests locally before committing** - saves time
5. **Use conventional commits consistently** - enables automation

## Integration with CI/CD

The same linting and testing standards are enforced in CI:

- GitHub Actions runs the same ESLint configuration
- Tests must pass in CI even if bypassed locally
- Commit messages are validated in PR checks

This ensures consistency between local development and CI environment.