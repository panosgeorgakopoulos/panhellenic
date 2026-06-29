import { supabase } from './supabaseClient.js';

export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

export async function saveProgress(userId, currentScenarios) {
    const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: userId,
            saved_scenarios: currentScenarios,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
    if (error) throw error;
    return data;
}

export async function loadProgress(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('saved_scenarios')
        .eq('user_id', userId)
        .single();
        
    if (error && error.code !== 'PGRST116') { // PGRST116 is the code for 'No rows found'
        throw error;
    }
    return data ? data.saved_scenarios : null;
}

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, is_admin, saved_scenarios')
        .eq('user_id', userId)
        .single();
        
    if (error && error.code !== 'PGRST116') {
        throw error;
    }
    return data || {};
}

export async function updateProfile(userId, fullName) {
    const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: userId,
            full_name: fullName,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
    if (error) throw error;
    return data;
}

export async function getGlobalStats() {
    const { data, error } = await supabase.rpc('get_global_stats');
    if (error) throw error;
    return data;
}
