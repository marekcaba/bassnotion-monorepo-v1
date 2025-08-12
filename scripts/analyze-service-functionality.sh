#!/bin/bash

# Script to analyze functionality of each service

SERVICES_DIR="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/apps/frontend/src/domains/playback/services"
OUTPUT_FILE="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/docs/2. Stories/2. 🚧 in-progress/EPIC 3/service-functionality-analysis.txt"

echo "Service Functionality Analysis" > "$OUTPUT_FILE"
echo "=============================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Function to extract main class/interface description
extract_functionality() {
    local file=$1
    local service_name=$(basename "$file" .ts)
    
    echo "" >> "$OUTPUT_FILE"
    echo "=== $service_name ===" >> "$OUTPUT_FILE"
    echo "File: $file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # Extract JSDoc comments before class/interface declarations
    awk '
        /^\/\*\*/ { capturing = 1; doc = "" }
        capturing { doc = doc "\n" $0 }
        /\*\// && capturing { 
            capturing = 0; 
            getline; 
            if ($0 ~ /^(export )?(class|interface|const|function|abstract class)/) {
                print doc
                print $0
                found = 1
            }
        }
        END { if (!found) print "No main documentation found" }
    ' "$file" | head -n 30 >> "$OUTPUT_FILE"
    
    # Extract key methods/properties
    echo "" >> "$OUTPUT_FILE"
    echo "Key Methods/Properties:" >> "$OUTPUT_FILE"
    grep -E "^\s*(public |private |protected |static |async )?([\w]+)\s*\(" "$file" | head -n 10 | sed 's/^/  /' >> "$OUTPUT_FILE"
    
    echo "" >> "$OUTPUT_FILE"
}

# Process each service file
find "$SERVICES_DIR" -name "*.ts" -not -path "*/__tests__/*" -not -name "*.test.ts" -not -name "*.spec.ts" -not -name "index.ts" -not -name "types.ts" -not -name "constants.ts" | grep -v ".behavior.test.ts" | sort | while read -r file; do
    extract_functionality "$file"
done

echo "Analysis complete. Results saved to: $OUTPUT_FILE"