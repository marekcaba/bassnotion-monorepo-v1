#!/bin/bash

# BassNotion Dependency Update Script
# Use this to manually check and update dependencies instead of relying on frequent Dependabot runs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎸 BassNotion Dependency Update Script${NC}"
echo -e "${BLUE}======================================${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "pnpm-lock.yaml" ]; then
    print_error "This script must be run from the root of the bassnotion-monorepo-v1 project"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it first."
    exit 1
fi

print_info "Checking current project status..."

# 1. Security audit first
echo -e "\n${BLUE}1. Running security audit...${NC}"
if pnpm audit --audit-level moderate; then
    print_status "No security vulnerabilities found"
else
    print_warning "Security vulnerabilities detected! Check the output above."
    echo -e "${YELLOW}Consider running: pnpm audit --fix${NC}"
fi

# 2. Check for outdated packages
echo -e "\n${BLUE}2. Checking for outdated packages...${NC}"
print_info "Checking production dependencies..."
pnpm outdated --prod 2>/dev/null || print_info "All production dependencies are up to date"

print_info "Checking development dependencies..."
pnpm outdated --dev 2>/dev/null || print_info "All development dependencies are up to date"

# 3. Interactive update options
echo -e "\n${BLUE}3. Update options:${NC}"
echo "What would you like to do?"
echo "1) Conservative update (patches + security) - Recommended for stable projects"
echo "2) Update patch versions only"
echo "3) Update minor versions"
echo "4) Update major versions (requires testing)"
echo "5) Update specific package"
echo "6) Just show what would be updated"
echo "7) Exit without updating"

read -p "Enter your choice (1-7): " choice

case $choice in
    1)
        print_info "Running conservative update (patches + security)..."
        print_info "First, fixing any security vulnerabilities..."
        pnpm audit --fix 2>/dev/null || true
        print_info "Now updating patch versions only..."
        # Update patch versions and security fixes
        pnpm update --save-exact
        ;;
    2)
        print_info "Updating patch versions only..."
        pnpm update --latest --save-exact
        ;;
    3)
        print_info "Updating minor versions..."
        pnpm update
        ;;
    4)
        print_warning "Updating major versions - this may break things!"
        read -p "Are you sure? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            pnpm update --latest
        else
            print_info "Cancelled major version update"
        fi
        ;;
    5)
        read -p "Enter package name to update: " package_name
        if [ ! -z "$package_name" ]; then
            print_info "Updating $package_name..."
            pnpm update "$package_name" --latest
        else
            print_error "No package name provided"
        fi
        ;;
    6)
        print_info "Showing what would be updated (dry run)..."
        pnpm outdated
        ;;
    7)
        print_info "Exiting without updates"
        exit 0
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# 4. Run tests after updates (if any updates were made)
if [ "$choice" != "6" ] && [ "$choice" != "7" ]; then
    echo -e "\n${BLUE}4. Running tests to verify updates...${NC}"
    print_info "Running type checks..."
    if pnpm nx run-many --target=typecheck --all; then
        print_status "Type checks passed"
    else
        print_error "Type checks failed! You may need to fix compatibility issues."
    fi

    print_info "Running linting..."
    if pnpm nx run-many --target=lint --all; then
        print_status "Linting passed"
    else
        print_warning "Linting issues found. Consider running: pnpm nx run-many --target=lint --all --fix"
    fi

    print_info "Running unit tests..."
    if pnpm nx run-many --target=test --all; then
        print_status "All tests passed"
    else
        print_error "Some tests failed! Check the output above."
    fi

    echo -e "\n${GREEN}🎉 Dependency update process completed!${NC}"
    print_info "Don't forget to commit your changes and run a full E2E test suite"
    print_info "Suggested commit message: 'deps: update dependencies ($(date +%Y-%m-%d))'"
fi 