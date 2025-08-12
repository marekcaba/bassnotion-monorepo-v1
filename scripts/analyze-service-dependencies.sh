#!/bin/bash

# Script to analyze dependencies for playback services

SERVICES_DIR="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/apps/frontend/src/domains/playback/services"
WIDGETS_DIR="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/apps/frontend/src/domains/widgets"
OUTPUT_FILE="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/docs/2. Stories/2. 🚧 in-progress/EPIC 3/service-dependencies.txt"

echo "Service Dependencies Analysis" > "$OUTPUT_FILE"
echo "============================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Analyze widget dependencies
echo "WIDGET DEPENDENCIES" >> "$OUTPUT_FILE"
echo "==================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find all service imports from widget files
echo "Services used by widgets:" >> "$OUTPUT_FILE"
find "$WIDGETS_DIR" -name "*.ts" -o -name "*.tsx" | while read -r widget_file; do
    # Look for imports from playback/services
    imports=$(grep -E "from.*playback/services" "$widget_file" 2>/dev/null | grep -v "^//" | grep -v "^\s*/\*")
    if [ -n "$imports" ]; then
        widget_name=$(basename "$widget_file")
        echo "" >> "$OUTPUT_FILE"
        echo "Widget: $widget_name" >> "$OUTPUT_FILE"
        echo "$imports" | while read -r import_line; do
            # Extract service name from import
            service=$(echo "$import_line" | sed -E "s/.*from.*['\"].*\/([^/'\"]+)['\"].*/\1/")
            echo "  - $service" >> "$OUTPUT_FILE"
        done
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "SERVICE INTER-DEPENDENCIES" >> "$OUTPUT_FILE"
echo "=========================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Analyze inter-service dependencies
find "$SERVICES_DIR" -name "*.ts" -not -path "*/__tests__/*" | while read -r service_file; do
    service_name=$(basename "$service_file" .ts)
    
    # Look for imports from other services
    imports=$(grep -E "from.*\./|from.*services/" "$service_file" 2>/dev/null | grep -v "^//" | grep -v "^\s*/\*" | grep -v "__tests__")
    
    if [ -n "$imports" ]; then
        echo "" >> "$OUTPUT_FILE"
        echo "Service: $service_name" >> "$OUTPUT_FILE"
        echo "$imports" | while read -r import_line; do
            # Extract dependency name
            dep=$(echo "$import_line" | sed -E "s/.*from.*['\"]\.\/([^/'\"]+)['\"].*/\1/" | sed -E "s/.*from.*services\/([^/'\"]+)['\"].*/\1/")
            if [ "$dep" != "$import_line" ] && [ "$dep" != "index" ] && [ "$dep" != "types" ]; then
                echo "  - $dep" >> "$OUTPUT_FILE"
            fi
        done
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "Analysis complete. Results saved to: $OUTPUT_FILE"