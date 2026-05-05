import { createClient } from '@supabase/supabase-js'
import type { PushEmailConfig } from '../config'

export function createPushEmailSupabase(config: PushEmailConfig) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
