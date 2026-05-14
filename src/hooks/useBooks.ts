import { useState } from 'react'
import { supabase, type Book } from '../lib/supabaseClient'
import { toast } from 'sonner'

export const useBooks = () => {
  const [loading, setLoading] = useState(false)
  const [books, setBooks] = useState<Book[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const verifyUserExistence = async (user: any) => {
    if (!user.id) return false
    const { data, error } = await supabase
      .from('portal_users')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (error || !data) {
      localStorage.removeItem('biblio_user')
      window.location.reload() // Trigger App.tsx redirect
      return false
    }
    return true
  }

  const fetchBooks = async (page = 0, pageSize = 20, searchTerm = '', category = '', userCategory = '') => {
    setLoading(true)
    try {
      const currentUser = JSON.parse(localStorage.getItem('biblio_user') || '{}')
      if (currentUser.id) {
        const isAlive = await verifyUserExistence(currentUser)
        if (!isAlive) return
      }
      
      const columns = 'id, created_at, added_by, user_category, book_number, book_nomenclature, authority, price, category, page_count, serial_id, publisher, language, isbn, description, how_much_value, which_value, shelf_position, row_position, cover_page_url'
      
      let query = supabase
        .from('books')
        .select(columns, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      // Only show user's own records unless they are admin
      if (currentUser.role !== 'admin') {
        query = query.eq('added_by', currentUser.phone_number)
      }

      if (searchTerm) {
        const isNumeric = !isNaN(Number(searchTerm))
        if (isNumeric) {
          query = query.or(`book_nomenclature.ilike.%${searchTerm}%,authority.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%,book_number.eq.${searchTerm}`)
        } else {
          query = query.or(`book_nomenclature.ilike.%${searchTerm}%,authority.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%`)
        }
      }

      if (category) {
        query = query.eq('category', category)
      }

      if (userCategory) {
        query = query.eq('user_category', userCategory)
      }

      const { data, error, count } = await query

      if (error) throw error
      setBooks(data || [])
      setTotalCount(count || 0)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addBook = async (book: Book, silent = false) => {
    setLoading(true)
    try {
      const currentUser = JSON.parse(localStorage.getItem('biblio_user') || '{}')
      if (currentUser.id) {
        const isAlive = await verifyUserExistence(currentUser)
        if (!isAlive) return null
      }
      
      // Explicitly pick only the fields that exist in the database
      const { 
        id, book_number, book_nomenclature, authority, price, 
        category, page_count, serial_id, publisher, language, 
        isbn, description, how_much_value, which_value, 
        shelf_position, row_position, cover_page_url, user_category
      } = book;

      const bookToSave: any = {
        book_number,
        book_nomenclature,
        authority,
        price,
        category,
        page_count: page_count || 0, // Ensure page_count is never null
        serial_id,
        publisher,
        language,
        isbn,
        description,
        how_much_value,
        which_value,
        shelf_position,
        row_position,
        cover_page_url,
        added_by: currentUser.phone_number,
        user_category: user_category || (currentUser.assigned_category ? currentUser.assigned_category.split(',')[0] : 'Malayalam')
      }

      // Only include ID if it exists (for updates)
      if (id) {
        bookToSave.id = id
      }

      const { data, error } = await supabase
        .from('books')
        .upsert([bookToSave], { 
          onConflict: 'user_category,book_number',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (error) throw error
      if (!silent) toast.success('Book saved successfully!')
      return data // Return the saved record with its ID
    } catch (error: any) {
      console.error('Add/Upsert Error:', error)
      toast.error(error.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateBook = async (id: string, book: Partial<Book>) => {
    setLoading(true)
    try {
      // Remove book_name if it exists in the object to avoid schema errors
      const bookData = { ...book };
      delete (bookData as any).book_name;

      const { error } = await supabase.from('books').update(bookData).eq('id', id)
      if (error) throw error
      toast.success('Book updated successfully!')
      return true
    } catch (error: any) {
      toast.error(error.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteBook = async (id: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (error) throw error
      toast.success('Book deleted successfully!')
      return true
    } catch (error: any) {
      toast.error(error.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const getAllBooksForExport = async (category?: string, userCategory?: string) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('biblio_user') || '{}')
      const columns = 'id, created_at, added_by, user_category, book_number, book_nomenclature, authority, price, category, page_count, serial_id, publisher, language, isbn, description, how_much_value, which_value, shelf_position, row_position, cover_page_url'
      let query = supabase.from('books').select(columns)

      if (currentUser.role !== 'admin') {
        query = query.eq('added_by', currentUser.phone_number)
      }

      if (category) {
        query = query.eq('category', category)
      }

      if (userCategory) {
        query = query.eq('user_category', userCategory)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    } catch (error: any) {
      toast.error(error.message)
      return null
    }
  }

  return {
    loading,
    books,
    totalCount,
    fetchBooks,
    addBook,
    updateBook,
    deleteBook,
    getAllBooksForExport
  }
}
