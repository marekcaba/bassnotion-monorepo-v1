#!/bin/bash

# Monitor API requests for 50 seconds and count them
echo "🔍 Monitoring API requests for 50 seconds..."
echo "👉 Now go to your browser and perform your tutorial create/edit action"
echo ""

# Clear the backend logs first
pm2 flush bassnotion-backend

# Clear previous monitoring results
rm -f /tmp/api-requests.log
touch /tmp/api-requests.log

# Wait a bit
sleep 2

echo "📊 Starting monitoring..."
echo ""

# Get the log file path
LOG_FILE="/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/logs/backend-out.log"

# Start tailing the log file in background
# Use --line-buffered with grep to ensure real-time output
tail -f "$LOG_FILE" 2>/dev/null | grep --line-buffered -E '"method":"(GET|POST|PUT|DELETE)"' >> /tmp/api-requests.log &
TAIL_PID=$!

# Show countdown and stop after 50 seconds
for i in {50..1}; do
    echo -ne "\rTime remaining: ${i}s "
    sleep 1
done

# Stop monitoring
kill $TAIL_PID 2>/dev/null
sleep 1

echo ""
echo ""
echo "📈 Analysis Results:"
echo "==================="

# Count total requests
TOTAL=$(grep -c '"method"' /tmp/api-requests.log 2>/dev/null || echo 0)
echo "Total API requests: $TOTAL"

# Count by method
GET=$(grep -c '"method":"GET"' /tmp/api-requests.log 2>/dev/null || echo 0)
POST=$(grep -c '"method":"POST"' /tmp/api-requests.log 2>/dev/null || echo 0)
PUT=$(grep -c '"method":"PUT"' /tmp/api-requests.log 2>/dev/null || echo 0)
DELETE=$(grep -c '"method":"DELETE"' /tmp/api-requests.log 2>/dev/null || echo 0)

echo "  GET:    $GET"
echo "  POST:   $POST"
echo "  PUT:    $PUT"
echo "  DELETE: $DELETE"

echo ""
echo "🔝 Top 10 most called endpoints:"
grep -o '"url":"[^"]*"' /tmp/api-requests.log 2>/dev/null | sort | uniq -c | sort -rn | head -10

echo ""
echo "📝 Full log saved to: /tmp/api-requests.log"
echo ""
echo "💡 Tip: You can view the raw captured logs with: cat /tmp/api-requests.log"
