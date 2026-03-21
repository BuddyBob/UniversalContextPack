const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
   // Let's just pull a recent source and inspect its values
   const { data, error } = await supabase.from('pack_sources').select('*').order('created_at', {ascending: false}).limit(1);
   console.log(data);
}
test();
