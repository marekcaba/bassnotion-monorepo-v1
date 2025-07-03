#!/bin/bash

# Daily Creator Stats Update Script
# This script calls the backend API to update all YouTube creator statistics
# Designed to be run once daily via cron job

set -e  # Exit on any error

# Configuration
API_BASE_URL=${API_BASE_URL:-"http://localhost:3000"}
LOG_FILE="/var/log/bassnotion/creator-stats-update.log"
MAX_RETRIES=3
RETRY_DELAY=60  # seconds

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    log "ERROR: Creator stats update failed: $1"
    exit 1
}

# Main update function
update_creator_stats() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log "Attempt $attempt/$MAX_RETRIES: Starting creator stats batch update..."
        
        # Make API call to trigger batch update
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -H "User-Agent: BassNotion-CronJob/1.0" \
            --max-time 300 \
            "$API_BASE_URL/creators/batch-update" 2>&1)
        
        # Extract HTTP status code and response body
        http_code=$(echo "$response" | tail -n1)
        response_body=$(echo "$response" | head -n -1)
        
        case $http_code in
            200|201)
                log "SUCCESS: Creator stats updated successfully"
                log "Response: $response_body"
                return 0
                ;;
            *)
                log "WARNING: HTTP $http_code received. Response: $response_body"
                if [ $attempt -eq $MAX_RETRIES ]; then
                    handle_error "All retry attempts exhausted. Last error: HTTP $http_code"
                else
                    log "Retrying in $RETRY_DELAY seconds..."
                    sleep $RETRY_DELAY
                fi
                ;;
        esac
        
        ((attempt++))
    done
}

# Health check function
check_api_health() {
    log "Checking API health..."
    
    health_response=$(curl -s -w "\n%{http_code}" \
        -X GET \
        -H "Content-Type: application/json" \
        --max-time 30 \
        "$API_BASE_URL/creators/health" 2>&1)
    
    health_code=$(echo "$health_response" | tail -n1)
    health_body=$(echo "$health_response" | head -n -1)
    
    if [ "$health_code" != "200" ]; then
        handle_error "API health check failed: HTTP $health_code"
    fi
    
    log "API health check passed: $health_body"
}

# Cleanup function for graceful shutdown
cleanup() {
    log "Script interrupted. Cleaning up..."
    exit 1
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    log "=== Starting Daily Creator Stats Update ==="
    log "API Base URL: $API_BASE_URL"
    
    # Pre-flight health check
    check_api_health
    
    # Run the batch update
    update_creator_stats
    
    log "=== Creator Stats Update Completed Successfully ==="
}

# Run main function
main "$@" 