import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return (
    supabaseUrl && 
    supabaseUrl !== 'YOUR_SUPABASE_URL' && 
    supabaseAnonKey && 
    supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY'
  )
}

// Create client only if URL is valid to prevent crash
export const supabase = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder'
)

export type Book = {
  id?: string
  created_at?: string
  added_by?: string // Tracks the phone number of the user who added the book
  user_category?: string // Tracks the category of the user who added the book
  book_number?: number // Unique number assigned to the book based on user's range
  book_nomenclature: string
  authority: string
  price?: number
  category: string
  page_count: number
  serial_id?: string
  publisher?: string
  language?: string
  isbn?: string
  description?: string
  how_much_value?: string
  which_value?: string
  shelf_position?: string
  row_position?: string
  cover_page_url?: string
}
