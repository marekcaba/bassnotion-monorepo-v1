#!/bin/bash

# Script to audit playback services for Story 3.18.1

SERVICES_DIR="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/apps/frontend/src/domains/playback/services"
OUTPUT_FILE="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/docs/2. Stories/2. 🚧 in-progress/EPIC 3/service-audit-raw-data.csv"

# Create CSV header
echo "Service Name,File Path,Lines of Code,Category,Primary Functionality,Widget Dependencies,Quality Score,Integration Target,Risk Level,Rationale" > "$OUTPUT_FILE"

# Find all TypeScript service files excluding tests and utility files
find "$SERVICES_DIR" -name "*.ts" -not -path "*/__tests__/*" -not -name "*.test.ts" -not -name "*.spec.ts" -not -name "index.ts" -not -name "types.ts" -not -name "constants.ts" | grep -v ".behavior.test.ts" | sort | while read -r file; do
    # Extract service name from path
    service_name=$(basename "$file" .ts)
    
    # Get relative path from services directory
    relative_path=${file#$SERVICES_DIR/}
    
    # Count lines of code (excluding blank lines and comments)
    loc=$(grep -v '^\s*$' "$file" | grep -v '^\s*//' | grep -v '^\s*/\*' | wc -l | xargs)
    
    # Initialize fields
    category="TBD"
    functionality="TBD"
    dependencies="TBD"
    quality="TBD"
    target="TBD"
    risk="TBD"
    rationale="TBD"
    
    # Output to CSV
    echo "\"$service_name\",\"$relative_path\",$loc,\"$category\",\"$functionality\",\"$dependencies\",\"$quality\",\"$target\",\"$risk\",\"$rationale\"" >> "$OUTPUT_FILE"
done

echo "Audit data saved to: $OUTPUT_FILE"
echo "Total services audited: $(tail -n +2 "$OUTPUT_FILE" | wc -l)"