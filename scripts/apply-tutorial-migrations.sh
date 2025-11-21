#!/bin/bash

# Tutorial & Exercise System Migration Script
# This script applies all necessary migrations for Story 4.2

set -e  # Exit on error

echo "🚀 Starting Tutorial & Exercise System Migration..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it to your Supabase database URL:"
    echo "export DATABASE_URL='postgresql://postgres:[password]@[host]:[port]/postgres'"
    exit 1
fi

echo "📋 Migration Plan:"
echo "1. Add admin role to profiles table"
echo "2. Create tutorials and exercises tables"
echo "3. Set up storage buckets for MIDI files"
echo ""

read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 1
fi

echo ""
echo "Step 1/3: Adding admin role to profiles..."
psql $DATABASE_URL -f supabase/migrations/20241223_add_admin_role_to_profiles.sql
echo "✅ Admin role added"

echo ""
echo "Step 2/3: Creating tutorials and exercises tables..."
psql $DATABASE_URL -f supabase/migrations/20241223_create_tutorials_exercises.sql
echo "✅ Tables created"

echo ""
echo "Step 3/3: Setting up storage buckets..."
psql $DATABASE_URL -f supabase/storage/buckets.sql
echo "✅ Storage buckets configured"

echo ""
echo "🎉 Migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Grant admin role to your user:"
echo "   UPDATE profiles SET role = 'admin' WHERE id = 'your-user-id';"
echo ""
echo "2. Test the admin interface at:"
echo "   http://localhost:3001/admin/tutorials"
echo ""
echo "3. Create your first tutorial!"

# Optional: Run verification queries
echo ""
read -p "Would you like to verify the migration? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Running verification queries..."

    psql $DATABASE_URL -c "
        SELECT 'Tables created:' as status;
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('tutorials', 'exercises', 'tutorial_sections');

        SELECT 'RLS enabled:' as status;
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('tutorials', 'exercises');

        SELECT 'Storage bucket:' as status;
        SELECT id, name, public FROM storage.buckets WHERE id = 'exercise-files';

        SELECT 'Profile roles:' as status;
        SELECT DISTINCT role FROM profiles;
    "

    echo ""
    echo "✅ Verification complete!"
fi