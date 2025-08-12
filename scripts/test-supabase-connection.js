import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env.local') });

async function testConnection() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.log('❌ Connection failed:', error.message);
      return;
    }

    const audioBucket = buckets.find((b) => b.name === 'audio-samples');
    if (audioBucket) {
      console.log('✅ Connection successful - audio-samples bucket found');
      console.log('Bucket details:', {
        name: audioBucket.name,
        id: audioBucket.id,
        public: audioBucket.public,
      });
    } else {
      console.log(
        '⚠️  Connection successful but audio-samples bucket not found',
      );
      console.log(
        'Available buckets:',
        buckets.map((b) => b.name),
      );
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
  }
}

testConnection();
