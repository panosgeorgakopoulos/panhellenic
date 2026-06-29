import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL Check:', supabaseUrl ? supabaseUrl.substring(0, 8) : 'undefined');
console.log('Supabase Key Check:', supabaseAnonKey ? supabaseAnonKey.substring(0, 4) : 'undefined');

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
