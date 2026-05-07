import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info.tsx';

export const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
