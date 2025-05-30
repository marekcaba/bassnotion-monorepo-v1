# Archived Docker Files

This directory contains Docker files that were moved from the project root for better organization.

## Files

- `Dockerfile` - Original main Dockerfile (replaced by `Dockerfile.final` in root)
- `Dockerfile.debug` - Debug version with development tools
- `Dockerfile.new` - Experimental Dockerfile version
- `Dockerfile.test` - Test-specific Dockerfile for CI/CD

## Active Docker Configuration

The currently active Docker configuration is:

- **Production**: `Dockerfile.final` (in project root)
- **Configuration**: `railway.json` references `Dockerfile.final`

## Why These Were Archived

These files were moved from the project root to:

1. Reduce clutter in the main directory
2. Preserve historical Docker configurations
3. Maintain a clean project structure
4. Keep only the active Dockerfile in root

## Usage

If you need to reference or restore any of these configurations:

1. Copy the desired file back to the project root
2. Update `railway.json` to reference the new file
3. Test the build process before deploying

**Last Updated**: May 27, 2025
