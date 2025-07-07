import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pntzjkvmbifntjhwtbll.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBudHpqa3ZtYmlmbnRqaHd0YmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDk3ODUsImV4cCI6MjA2NzQ4NTc4NX0.chQS0z01c6LPp58WkjAhiMNJUAXhaCvRtVOoRp2Z_YQ'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)