# Scripts Directory

This directory contains utility scripts for the BassNotion project.

## Dependency Management

### Problem

Dependabot was creating too many PRs (running ~20 times per hour instead of weekly), causing notification spam and making it hard to focus on actual development work.

### Solution

We've implemented a controlled dependency update approach:

1. **Restrictive Dependabot Configuration** (`.github/dependabot.yml`):

   - Updates only **monthly** (15th for npm, 1st for GitHub Actions)
   - Limited to 3 concurrent PRs max
   - Only patch-level updates for most dependencies
   - Ignores noisy dev dependencies like `@types/*`, `@nx/*`, etc.
   - Groups related updates together

2. **Manual Dependency Script** (`dependency-update.sh`):
   - Interactive script for controlled updates
   - Security audit first
   - Options for patch/minor/major updates
   - Automatic testing after updates
   - Safe and guided process

### Usage

#### Quick Commands

```bash
# Check and update dependencies interactively
pnpm run deps:check

# Just check for security vulnerabilities
pnpm run deps:audit

# See what packages are outdated
pnpm run deps:outdated
```

#### Manual Script

```bash
# Run the interactive dependency update script
./scripts/dependency-update.sh
```

#### Script Options

1. **Update patch versions only** - Safest option, minimal breaking changes
2. **Update minor versions** - Recommended for regular updates
3. **Update major versions** - Requires careful testing
4. **Update specific package** - Target a single dependency
5. **Dry run** - Just show what would be updated
6. **Exit** - Cancel without changes

### Best Practices

1. **Run monthly**: Use the script once or twice per month
2. **Security first**: Always check for security vulnerabilities first
3. **Test thoroughly**: The script runs tests automatically, but consider manual testing for major updates
4. **Commit carefully**: Use the suggested commit message format
5. **Branch for major updates**: Create a separate branch for major version updates

### When to Use Each Option

- **Patch updates (1)**: Regular maintenance, usually safe
- **Minor updates (2)**: Monthly updates, may include new features
- **Major updates (3)**: Quarterly or as needed, requires thorough testing
- **Specific package (4)**: When you need to update just one dependency
- **Dry run (5)**: To see what's available before committing to updates

This approach gives you control over when and how dependencies are updated, reducing noise while maintaining security and keeping packages reasonably current.
