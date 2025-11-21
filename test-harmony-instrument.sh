#!/bin/bash
#
# Test script to verify harmony_instrument field is being returned by the API
#

echo "🔍 Testing API response for exercises..."
echo ""

# Get the API URL from the environment
API_URL="http://localhost:3000"

# Fetch all exercises and check for harmony_instrument field
echo "📡 Fetching exercises from $API_URL/api/exercises..."
response=$(curl -s "$API_URL/api/exercises")

echo ""
echo "🔍 Checking for harmony_instrument in response..."
echo "$response" | jq '.exercises[] | {id, title, harmony_instrument}' 2>/dev/null || echo "⚠️  jq not installed - showing raw response"

echo ""
echo "📊 Summary:"
echo "$response" | jq '.exercises | length' 2>/dev/null && echo "exercises found" || echo "Could not parse response"

echo ""
echo "🎹 Grand Piano exercises:"
echo "$response" | jq '.exercises[] | select(.title | contains("Grand Piano")) | {id, title, harmony_instrument}' 2>/dev/null || echo "⚠️  jq not installed"

echo ""
echo "🎹 Come Together exercises:"
echo "$response" | jq '.exercises[] | select(.title | contains("Come Together")) | {id, title, harmony_instrument}' 2>/dev/null || echo "⚠️  jq not installed"

echo ""
echo "✅ Test complete!"
echo ""
echo "👉 Next steps:"
echo "1. Check if harmony_instrument field appears in the JSON output above"
echo "2. If it's null or missing, the database needs to be updated"
echo "3. If it exists, the issue is in the frontend mapping"
