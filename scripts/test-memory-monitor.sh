#!/bin/bash

# Memory Monitor for Test Execution
# This script monitors memory usage during test execution and provides insights

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_MEMORY_MB=6144
MEMORY_CHECK_INTERVAL=5
LOG_FILE="logs/test-memory-$(date +%Y%m%d_%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${BLUE}🔍 Starting Memory Monitor for Test Execution${NC}"
echo -e "${BLUE}📊 Max Memory Limit: ${MAX_MEMORY_MB}MB${NC}"
echo -e "${BLUE}📝 Log File: ${LOG_FILE}${NC}"
echo ""

# Function to get memory usage
get_memory_usage() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        ps -A -o pid,ppid,rss,comm | grep -E "(vitest|node)" | awk '{sum+=$3} END {print sum/1024}'
    else
        # Linux
        ps -A -o pid,ppid,rss,comm | grep -E "(vitest|node)" | awk '{sum+=$3} END {print sum/1024}'
    fi
}

# Function to monitor memory during command execution
monitor_memory() {
    local cmd="$1"
    local domain="$2"
    
    echo -e "${YELLOW}🚀 Starting: $domain${NC}"
    echo "$(date): Starting $domain - Command: $cmd" >> "$LOG_FILE"
    
    # Start the command in background
    eval "$cmd" &
    local cmd_pid=$!
    
    # Monitor memory usage
    local max_memory=0
    local current_memory=0
    
    while kill -0 $cmd_pid 2>/dev/null; do
        current_memory=$(get_memory_usage)
        if (( $(echo "$current_memory > $max_memory" | bc -l) )); then
            max_memory=$current_memory
        fi
        
        # Log current memory usage
        echo "$(date): $domain - Current Memory: ${current_memory}MB, Peak: ${max_memory}MB" >> "$LOG_FILE"
        
        # Check if memory usage is too high
        if (( $(echo "$current_memory > $MAX_MEMORY_MB" | bc -l) )); then
            echo -e "${RED}⚠️  WARNING: Memory usage ($current_memory MB) exceeds limit ($MAX_MEMORY_MB MB)${NC}"
            echo "$(date): WARNING - $domain memory usage exceeded limit: ${current_memory}MB" >> "$LOG_FILE"
        fi
        
        sleep $MEMORY_CHECK_INTERVAL
    done
    
    # Wait for command to complete and get exit code
    wait $cmd_pid
    local exit_code=$?
    
    echo -e "${GREEN}✅ Completed: $domain (Peak Memory: ${max_memory}MB)${NC}"
    echo "$(date): Completed $domain - Exit Code: $exit_code, Peak Memory: ${max_memory}MB" >> "$LOG_FILE"
    echo ""
    
    return $exit_code
}

# Function to run domain-based tests with memory monitoring
run_domain_tests() {
    local failed_domains=()
    local total_peak_memory=0
    
    echo -e "${BLUE}🧪 Running Domain-Based Tests with Memory Monitoring${NC}"
    echo ""
    
    # Test each domain separately
    domains=(
        "pnpm run test:frontend:playback|Playback Domain"
        "pnpm run test:frontend:user|User Domain"
        "pnpm run test:frontend:shared|Shared Domain"
    )
    
    for domain_cmd in "${domains[@]}"; do
        IFS='|' read -r cmd domain <<< "$domain_cmd"
        
        if ! monitor_memory "$cmd" "$domain"; then
            failed_domains+=("$domain")
        fi
        
        # Brief pause between domains to allow memory cleanup
        sleep 2
    done
    
    # Summary
    echo -e "${BLUE}📊 Test Execution Summary${NC}"
    echo -e "${BLUE}========================${NC}"
    
    if [ ${#failed_domains[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All domains passed successfully!${NC}"
    else
        echo -e "${RED}❌ Failed domains: ${failed_domains[*]}${NC}"
    fi
    
    echo -e "${BLUE}📝 Detailed logs available at: $LOG_FILE${NC}"
    
    # Return exit code based on failures
    return ${#failed_domains[@]}
}

# Function to analyze memory patterns
analyze_memory_patterns() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}⚠️  No log file found for analysis${NC}"
        return
    fi
    
    echo -e "${BLUE}🔍 Memory Pattern Analysis${NC}"
    echo -e "${BLUE}===========================${NC}"
    
    # Extract peak memory for each domain
    echo -e "${YELLOW}Peak Memory Usage by Domain:${NC}"
    grep "Peak Memory" "$LOG_FILE" | while read -r line; do
        echo "  $line"
    done
    
    echo ""
    
    # Check for memory warnings
    warning_count=$(grep -c "WARNING.*memory usage exceeded" "$LOG_FILE" || echo "0")
    if [ "$warning_count" -gt 0 ]; then
        echo -e "${RED}⚠️  Memory warnings detected: $warning_count${NC}"
        echo -e "${YELLOW}Warning details:${NC}"
        grep "WARNING.*memory usage exceeded" "$LOG_FILE" | while read -r line; do
            echo "  $line"
        done
    else
        echo -e "${GREEN}✅ No memory warnings detected${NC}"
    fi
}

# Main execution
main() {
    case "${1:-run}" in
        "run")
            run_domain_tests
            analyze_memory_patterns
            ;;
        "analyze")
            analyze_memory_patterns
            ;;
        "monitor")
            if [ -z "$2" ]; then
                echo -e "${RED}❌ Please provide a command to monitor${NC}"
                echo "Usage: $0 monitor \"your-command-here\""
                exit 1
            fi
            monitor_memory "$2" "Custom Command"
            ;;
        *)
            echo "Usage: $0 [run|analyze|monitor \"command\"]"
            echo "  run     - Run domain-based tests with memory monitoring (default)"
            echo "  analyze - Analyze existing memory logs"
            echo "  monitor - Monitor memory usage of a specific command"
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v bc &> /dev/null; then
    echo -e "${RED}❌ 'bc' calculator is required but not installed${NC}"
    echo "Install with: brew install bc (macOS) or apt-get install bc (Ubuntu)"
    exit 1
fi

main "$@" 