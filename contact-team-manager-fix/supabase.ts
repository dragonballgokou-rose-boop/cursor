import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        lock: async (_name, _acquireTimeout, fn) => {
            return await fn();
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 2,
        },
    },
});

let realtimePaused = false;

export function isRealtimePaused(): boolean {
    return realtimePaused;
}

export function pauseRealtime(): void {
    if (realtimePaused) return;
    realtimePaused = true;
    supabase.removeAllChannels();
    console.warn('[supabase] Realtime paused due to quota/service error. App continues in polling mode.');
}

export function safeChannel(name: string) {
    if (realtimePaused) return null;
    return supabase.channel(name);
}
