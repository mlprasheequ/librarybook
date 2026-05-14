import React, { useState, useEffect } from 'react'
import { useBooks } from '../hooks/useBooks'
import { supabase } from '../lib/supabaseClient'
import { Search, ChevronLeft, ChevronRight, FileJson, Download, Loader2, Users, BookOpen, Plus, Trash2, Shield, Edit2, X, Settings, Globe, PlusSquare } from 'lucide-react'
import { toast } from 'sonner'
import { type Book } from '../lib/supabaseClient'
import { BookForm } from './BookForm'

export const AdminTable = () => {
  const { books, totalCount, fetchBooks, loading, getAllBooksForExport, deleteBook, updateBook } = useBooks()
  const [activeTab, setActiveTab] = useState<'books' | 'users' | 'settings' | 'add'>('books')
  const [page, setPage] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterUserCategory, setFilterUserCategory] = useState('')
  const [jsonPreview, setJsonPreview] = useState<string | null>(null)
  const [sqlPreview, setSqlPreview] = useState<string | null>(null)
  
  // Settings Management State
  const [systemSettings, setSystemSettings] = useState<{ languages: string[], userCategories: string[], bookCategories: string[] }>({ languages: [], userCategories: [], bookCategories: [] })
  const [newLanguage, setNewLanguage] = useState('')
  const [newUserCategoryOption, setNewUserCategoryOption] = useState('')
  const [newBookCategoryOption, setNewBookCategoryOption] = useState('')
  const [loadingSettings, setLoadingSettings] = useState(false)
  
  // Get current user role from localStorage
  const currentUser = JSON.parse(localStorage.getItem('biblio_user') || '{}')
  const isAdmin = currentUser.role === 'admin'
  
  // User Management State
  const [newUserName, setNewUserName] = useState('')
  const [newUserPhone, setNewUserPhone] = useState('+91 ')
  const [newUserCategories, setNewUserCategories] = useState<string[]>([])
  const [quickAddCategory, setQuickAddCategory] = useState('')
  const [userStartNo, setUserStartNo] = useState<string>('1')
  const [userEndNo, setUserEndNo] = useState<string>('200')
  const [creatingUser, setCreatingUser] = useState(false)
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Edit State
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<Book>>({})
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // User Edit State
  const [editingUserObj, setEditingUserObj] = useState<any>(null)
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false)

  // Color Generator
  const getUserColor = (phone: string) => {
    if (!phone) return '#71717a'
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
    ]
    let hash = 0
    const cleanPhone = phone.replace(/\D/g, '')
    for (let i = 0; i < cleanPhone.length; i++) {
      hash = cleanPhone.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }
  
  const pageSize = 10

  useEffect(() => {
    if (activeTab === 'books') {
      const timer = setTimeout(() => {
        fetchBooks(page, pageSize, searchTerm, filterCategory, filterUserCategory)
      }, 300)
      return () => clearTimeout(timer)
    } else if (activeTab === 'users' && isAdmin) {
      fetchUsers()
    } else if (activeTab === 'settings' && isAdmin) {
      fetchSettings()
    }
  }, [page, searchTerm, activeTab, filterCategory, filterUserCategory])

  const fetchSettings = async () => {
    setLoadingSettings(true)
    try {
      const { data, error } = await supabase.from('system_settings').select('*')
      if (error) {
        console.error('Settings fetch error:', error)
        throw error
      }
      
      if (data) {
        const languages = data.filter(s => s.type === 'language').map(s => s.value)
        const userCategories = data.filter(s => s.type === 'user_category').map(s => s.value)
        const bookCategories = data.filter(s => s.type === 'book_category').map(s => s.value)
        
        // Default values if empty
        const defaultUserCats = userCategories.length > 0 ? userCategories : ['Malayalam', 'Arabic', 'Reference']
        const defaultBookCats = bookCategories.length > 0 ? bookCategories : ['ٱلْكُتُب', 'General', 'Reference']
        
        setSystemSettings({ 
          languages, 
          userCategories: defaultUserCats,
          bookCategories: defaultBookCats
        })
      } else {
        setSystemSettings({ 
          languages: [], 
          userCategories: ['Malayalam', 'Arabic', 'Reference'],
          bookCategories: ['ٱلْكُتُب', 'General', 'Reference']
        })
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error)
      toast.error('Could not load settings.')
      setSystemSettings({ 
        languages: [], 
        userCategories: ['Malayalam', 'Arabic', 'Reference'],
        bookCategories: ['ٱلْكُتُب', 'General', 'Reference']
      })
    } finally {
      setLoadingSettings(false)
    }
  }

  const LANGUAGES = systemSettings.languages
  const USER_CATEGORIES = systemSettings.userCategories
  const BOOK_CATEGORIES = systemSettings.bookCategories

  const handleAddSetting = async (type: 'language' | 'user_category' | 'book_category', value: string) => {
    if (!value.trim()) return
    try {
      const list = type === 'language' ? systemSettings.languages : 
                   type === 'user_category' ? systemSettings.userCategories :
                   systemSettings.bookCategories;
                   
      const existing = list.find(l => l.toLowerCase() === value.trim().toLowerCase());
      if (existing) {
        toast.error(`The ${type.replace('_', ' ')} "${value.trim()}" already exists.`);
        return;
      }

      const { error } = await supabase.from('system_settings').insert([{ type, value: value.trim() }])
      if (error) {
        if (error.code === '23505') {
          toast.error(`The ${type.replace('_', ' ')} "${value.trim()}" already exists in the database.`);
        } else {
          throw error;
        }
      } else {
        toast.success(`${type.replace('_', ' ')} added!`)
        if (type === 'language') setNewLanguage('')
        else if (type === 'user_category') setNewUserCategoryOption('')
        else setNewBookCategoryOption('')
        fetchSettings()
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleDeleteSetting = async (type: 'language' | 'user_category' | 'book_category', value: string) => {
    try {
      const { error } = await supabase.from('system_settings').delete().eq('type', type).eq('value', value)
      if (error) throw error
      toast.success(`${type.replace('_', ' ')} removed!`)
      fetchSettings()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase.from('portal_users').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setRegisteredUsers(data || [])
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? They will lose access immediately.')) return
    try {
      // Optimistic update: Remove from UI first for instant feedback
      setRegisteredUsers(prev => prev.filter(u => u.id !== id))
      
      const { error } = await supabase.from('portal_users').delete().eq('id', id)
      if (error) {
        // If DB fails, revert the UI and show error
        fetchUsers()
        throw error
      }
      toast.success('User permanently removed from database')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user. Check database permissions.')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isAdmin) {
      toast.error('Security Violation: Only admins can add users.')
      return
    }

    if (newUserCategories.length === 0) {
      toast.error('Please select at least one category.')
      return
    }

    setCreatingUser(true)
    
    try {
      const start = parseInt(userStartNo)
      const end = parseInt(userEndNo)

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        toast.error('Invalid range. Please check Start and End numbers.')
        setCreatingUser(false)
        return
      }

      const { error } = await supabase
        .from('portal_users')
        .insert([{ 
          name: newUserName.trim(), 
          phone_number: newUserPhone.trim(),
          role: 'operator',
          assigned_category: newUserCategories.join(','),
          start_range: start,
          end_range: end
        }])
      
      if (error) throw error
      
      toast.success(`User Added to ${newUserCategories.join(', ')}! Range: ${start}-${end}`)
      setNewUserName('')
      setNewUserPhone('+91 ')
      setNewUserCategories([])
      setUserStartNo('1')
      setUserEndNo('200')
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add user')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!editingUserObj) return
    try {
      const { id, ...updates } = editingUserObj
      const { error } = await supabase.from('portal_users').update({
        name: updates.name,
        phone_number: updates.phone_number,
        assigned_category: Array.isArray(updates.assigned_category) 
          ? updates.assigned_category.join(',') 
          : updates.assigned_category,
        start_range: updates.start_range,
        end_range: updates.end_range
      }).eq('id', id)
      
      if (error) throw error
      toast.success('User updated successfully')
      setIsUserEditModalOpen(false)
      setEditingUserObj(null)
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const startEditingUser = (user: any) => {
    setEditingUserObj({
      ...user,
      assigned_category: user.assigned_category ? user.assigned_category.split(',') : []
    })
    setIsUserEditModalOpen(true)
  }

  const toggleEditUserCategory = (category: string) => {
    setEditingUserObj((prev: any) => {
      const current = prev.assigned_category || []
      const updated = current.includes(category)
        ? current.filter((c: string) => c !== category)
        : [...current, category]
      return { ...prev, assigned_category: updated }
    })
  }

  const toggleCategory = (category: string) => {
    setNewUserCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    )
  }

  const handleQuickAddCategory = async (target: 'create' | 'edit') => {
    if (!quickAddCategory.trim()) return
    try {
      const existing = systemSettings.userCategories.find(c => c.toLowerCase() === quickAddCategory.trim().toLowerCase())
      if (existing) {
        toast.error('Category already exists')
        return
      }

      const { error } = await supabase.from('system_settings').insert([{ type: 'user_category', value: quickAddCategory.trim() }])
      if (error) throw error
      
      toast.success('Category added to system')
      const newCat = quickAddCategory.trim()
      
      if (target === 'create') {
        setNewUserCategories(prev => [...prev, newCat])
      } else {
        setEditingUserObj((prev: any) => ({
          ...prev,
          assigned_category: [...(prev.assigned_category || []), newCat]
        }))
      }
      
      setQuickAddCategory('')
      fetchSettings()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const copyJsonToClipboard = async () => {
    if (!jsonPreview) return
    try {
      await navigator.clipboard.writeText(jsonPreview)
      toast.success('JSON copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy JSON')
    }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this book record? This will remove it from the database permanently.')) return
    const success = await deleteBook(id)
    if (success) {
      toast.success('Book removed from database')
      fetchBooks(page, pageSize, searchTerm)
    }
  }

  const startEditing = (book: Book) => {
    setEditingBookId(book.id || null)
    setEditFormData({ ...book })
    setIsEditModalOpen(true)
  }

  const cancelEditing = () => {
    setEditingBookId(null)
    setEditFormData({})
    setIsEditModalOpen(false)
  }

  const saveEdit = async () => {
    if (!editingBookId) return
    const success = await updateBook(editingBookId, editFormData)
    if (success) {
      setEditingBookId(null)
      setIsEditModalOpen(false)
      fetchBooks(page, pageSize, searchTerm)
    }
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
    }))
  }

  const handleExportJson = async () => {
    const data = await getAllBooksForExport(filterCategory, filterUserCategory)
    if (data) {
      // Sort by book number for cleaner export
      const sortedData = [...data]
        .sort((a, b) => (a.book_number || 0) - (b.book_number || 0))
        .map(book => ({
          book_nomenclature: book.book_nomenclature,
          authority: book.authority,
          price: book.price,
          category: book.category,
          page_count: book.page_count,
          serial_id: book.serial_id,
          publisher: book.publisher,
          language: book.language,
          isbn: book.isbn,
          description: book.description,
          how_much_value: book.how_much_value,
          which_value: book.which_value,
          shelf_position: book.shelf_position,
          row_position: book.row_position,
          cover_page_url: book.cover_page_url
        }))
      setJsonPreview(JSON.stringify(sortedData, null, 2))
    }
  }

  const handleExportSql = async () => {
    const data = await getAllBooksForExport(filterCategory, filterUserCategory)
    if (data && data.length > 0) {
      const sortedData = [...data].sort((a, b) => (a.book_number || 0) - (b.book_number || 0))
      const sql = sortedData.map((book: any) => {
        const columns = Object.keys(book).filter(k => k !== 'id' && k !== 'created_at' && k !== 'book_name').join(', ')
        const values = Object.values(book).filter((_, i) => {
          const key = Object.keys(book)[i]
          return key !== 'id' && key !== 'created_at' && key !== 'book_name'
        })
          .map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : v)
          .join(', ')
        return `INSERT INTO books (${columns}) VALUES (${values});`
      }).join('\n')
      
      setSqlPreview(sql)
    } else {
      toast.info('No records to export')
    }
  }

  const downloadJson = () => {
    if (!jsonPreview) return
    const blob = new Blob([jsonPreview], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `biblio_export_${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadSql = () => {
    if (!sqlPreview) return
    const blob = new Blob([sqlPreview], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `biblio_export_${new Date().toISOString()}.sql`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const tabClasses = (tab: string) => `flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-black shadow-lg shadow-white/10 scale-105' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`



  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Edit Book Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-white/10 shadow-2xl p-8 lg:p-12">
            <div className="flex justify-between items-start mb-10 pb-6 border-b border-white/5">
              <div>
                <h3 className="text-3xl font-black text-white tracking-tight mb-2">Edit Record</h3>
                <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Database ID: {editingBookId?.slice(0, 8)}...</p>
              </div>
              <button onClick={cancelEditing} className="p-3 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Identity Section */}
              <div className="space-y-6 md:col-span-2">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Archive Nomenclature *</label>
                  <input
                    name="book_nomenclature"
                    value={editFormData.book_nomenclature || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Description</label>
                  <textarea
                    name="description"
                    value={editFormData.description || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              {/* Core Specs */}
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Primary Authority (Author) *</label>
                <input
                  name="authority"
                  value={editFormData.authority || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Assigned Category (User Cat) *</label>
                <select
                  name="user_category"
                  value={editFormData.user_category || ''}
                  onChange={handleEditChange}
                  className="w-full bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-5 py-4 text-emerald-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                >
                  <option value="" disabled className="bg-zinc-900">Select Assigned Category</option>
                  {USER_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Category (Classification) *</label>
                <select
                  name="category"
                  value={editFormData.category || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  <option value="" disabled className="bg-zinc-900">Select Classification</option>
                  {BOOK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
              </div>

              {/* Financials */}
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Price (INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-white font-black">₹</span>
                  <input
                    type="number"
                    name="price"
                    value={editFormData.price || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-white text-lg font-black focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Pages *</label>
                  <input
                    type="number"
                    name="page_count"
                    value={editFormData.page_count || 0}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Language</label>
                  <select
                    name="language"
                    value={editFormData.language || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="" disabled className="bg-zinc-900">Select Language</option>
                    {LANGUAGES.map(lang => <option key={lang} value={lang} className="bg-zinc-900">{lang}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Value Amt</label>
                  <input
                    name="how_much_value"
                    value={editFormData.how_much_value || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Unit</label>
                  <input
                    name="which_value"
                    value={editFormData.which_value || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              {/* Logistics */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Shelf</label>
                  <input
                    name="shelf_position"
                    value={editFormData.shelf_position || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Row</label>
                  <input
                    name="row_position"
                    value={editFormData.row_position || ''}
                    onChange={handleEditChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              {/* Final Specs */}
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Publisher</label>
                <input
                  name="publisher"
                  value={editFormData.publisher || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Cover URL</label>
                <input
                  name="cover_page_url"
                  value={editFormData.cover_page_url || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
            </div>

            <div className="mt-12 flex gap-4">
              <button
                onClick={saveEdit}
                className="flex-1 bg-white text-black font-black py-5 rounded-[1.5rem] hover:bg-zinc-200 transition-all shadow-xl shadow-white/5"
              >
                Save Changes
              </button>
              <button
                onClick={cancelEditing}
                className="flex-1 bg-white/5 text-white font-black py-5 rounded-[1.5rem] border border-white/10 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit User Modal */}
      {isUserEditModalOpen && editingUserObj && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-white/10 shadow-2xl p-8 lg:p-12">
            <div className="flex justify-between items-start mb-10 pb-6 border-b border-white/5">
              <div>
                <h3 className="text-3xl font-black text-white tracking-tight mb-2">Edit Authority</h3>
                <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">User ID: {editingUserObj.id.slice(0, 8)}...</p>
              </div>
              <button onClick={() => setIsUserEditModalOpen(false)} className="p-3 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Operator Name</label>
                <div className="relative">
                  <Users className="absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                  <input
                    type="text"
                    value={editingUserObj.name}
                    onChange={(e) => setEditingUserObj({ ...editingUserObj, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                  <input
                    type="text"
                    value={editingUserObj.phone_number}
                    onChange={(e) => setEditingUserObj({ ...editingUserObj, phone_number: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Assigned Categories</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {USER_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleEditUserCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                        editingUserObj.assigned_category.includes(cat) 
                          ? 'bg-white text-black border-white' 
                          : 'bg-white/5 text-zinc-500 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Quick Add for Edit Modal */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickAddCategory}
                    onChange={(e) => setQuickAddCategory(e.target.value)}
                    placeholder="New Category Name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 text-[10px] font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickAddCategory('edit')}
                    className="px-4 py-2 bg-white/5 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Start No.</label>
                  <input
                    type="number"
                    value={editingUserObj.start_range}
                    onChange={(e) => setEditingUserObj({ ...editingUserObj, start_range: parseInt(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">End No.</label>
                  <input
                    type="number"
                    value={editingUserObj.end_range}
                    onChange={(e) => setEditingUserObj({ ...editingUserObj, end_range: parseInt(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="mt-12 flex gap-4">
              <button
                onClick={handleUpdateUser}
                className="flex-1 bg-white text-black font-black py-5 rounded-[1.5rem] hover:bg-zinc-200 transition-all shadow-xl shadow-white/5"
              >
                Save Changes
              </button>
              <button
                onClick={() => setIsUserEditModalOpen(false)}
                className="flex-1 bg-white/5 text-white font-black py-5 rounded-[1.5rem] border border-white/10 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/[0.02] p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/5">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tighter mb-2">Management Console</h2>
          <p className="text-zinc-500 font-medium text-xs sm:text-sm">Registry control and operator provisioning.</p>
        </div>
        <div className="flex flex-wrap bg-black/40 p-1 sm:p-2 rounded-2xl border border-white/10 shadow-2xl w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('books')} 
            className={`${tabClasses('books')} flex-1 md:flex-none justify-center`}
          >
            <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">View Records</span><span className="sm:hidden">Books</span>
          </button>
          
          {isAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('add')} 
                className={`${tabClasses('add')} flex-1 md:flex-none justify-center`}
              >
                <PlusSquare className="h-4 w-4" /> <span className="hidden sm:inline">Add Entry</span><span className="sm:hidden">Add</span>
              </button>
              <button 
                onClick={() => setActiveTab('users')} 
                className={`${tabClasses('users')} flex-1 md:flex-none justify-center`}
              >
                <Users className="h-4 w-4" /> <span className="hidden sm:inline">Users</span><span className="sm:hidden">Users</span>
              </button>
              <button 
                onClick={() => setActiveTab('settings')} 
                className={`${tabClasses('settings')} flex-1 md:flex-none justify-center`}
              >
                <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span><span className="sm:hidden">Sets</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'books' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 flex gap-4">
              <div className="relative group flex-1">
                <Search className="absolute left-4 top-4 h-5 w-5 text-zinc-600 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  placeholder="Search by Number, Nomenclature, Author..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(0)
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="relative group">
                <Globe className="absolute left-4 top-4 h-5 w-5 text-zinc-600 group-focus-within:text-white transition-colors" />
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value)
                    setPage(0)
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm font-medium appearance-none cursor-pointer"
                >
                  <option value="" className="bg-zinc-900">Book Categories</option>
                  {BOOK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="relative group">
                <Globe className="absolute left-4 top-4 h-5 w-5 text-zinc-600 group-focus-within:text-white transition-colors" />
                <select
                  value={filterUserCategory}
                  onChange={(e) => {
                    setFilterUserCategory(e.target.value)
                    setPage(0)
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm font-medium appearance-none cursor-pointer"
                >
                  <option value="" className="bg-zinc-900">User Categories</option>
                  {USER_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-3 flex gap-2">
              <button
                onClick={handleExportJson}
                title="Export as JSON"
                className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-4 rounded-2xl bg-white/5 text-white font-bold text-[8px] sm:text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
              >
                <FileJson className="h-4 w-4" /> JSON
              </button>
              {jsonPreview && (
                <button
                  onClick={copyJsonToClipboard}
                  title="Copy JSON to Clipboard"
                  className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-4 rounded-2xl bg-emerald-500/10 text-emerald-500 font-bold text-[8px] sm:text-[10px] uppercase tracking-widest hover:bg-emerald-500/20 transition-all border border-emerald-500/10"
                >
                  <FileJson className="h-4 w-4" /> Copy
                </button>
              )}
              <button
                onClick={handleExportSql}
                title="Export as SQL"
                className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-4 rounded-2xl bg-white/5 text-white font-bold text-[8px] sm:text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
              >
                <Download className="h-4 w-4" /> SQL
              </button>
            </div>
          </div>

          <div className="glass-card rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
            {/* Mobile View: Vertical Cards */}
            <div className="lg:hidden divide-y divide-white/5">
              {loading ? (
                <div className="py-20 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-white mx-auto opacity-20" />
                </div>
              ) : books.length === 0 ? (
                <div className="py-20 text-center text-zinc-600 font-bold uppercase tracking-widest text-xs">
                  No encrypted records found in the database.
                </div>
              ) : (
                books.map((book) => (
                  <div key={book.id} className="p-6 space-y-4 bg-white/[0.01]">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-sm leading-tight">{book.book_nomenclature}</div>
                        <div className="text-[10px] text-zinc-600 font-bold mt-1 uppercase">Book No: {book.book_number}</div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button onClick={() => startEditing(book)} className="p-2 rounded-lg bg-white/5 text-zinc-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteBook(book.id!)} className="p-2 rounded-lg bg-red-500/10 text-red-500"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Authority</div>
                        <div className="text-xs text-zinc-400">{book.authority}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Classification</div>
                        <span className="px-2 py-1 rounded-md bg-white/5 text-zinc-500 text-[8px] font-black uppercase tracking-widest">{book.category}</span>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Assigned Cat.</div>
                        <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest">{book.user_category || 'Malayalam'}</span>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Valuation</div>
                        <div className="text-xs text-white font-bold">{book.price ? `₹${book.price.toFixed(2)}` : 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-zinc-600 uppercase mb-1">Specs</div>
                        <div className="text-xs text-zinc-500 font-bold">{book.page_count} PAGES</div>
                      </div>
                    </div>

                    {/* Expanded Content for AdminTable Mobile */}
                    <div className="pt-4 grid grid-cols-2 gap-y-4 gap-x-2 border-t border-white/5 mt-4">
                      <div>
                        <div className="text-[7px] font-black text-zinc-700 uppercase mb-0.5">Language</div>
                        <div className="text-[10px] text-zinc-400">{book.language}</div>
                      </div>
                      <div>
                        <div className="text-[7px] font-black text-zinc-700 uppercase mb-0.5">Publisher</div>
                        <div className="text-[10px] text-zinc-400">{book.publisher || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-[7px] font-black text-zinc-700 uppercase mb-0.5">Amount/Unit</div>
                        <div className="text-[10px] text-zinc-400">{book.how_much_value} {book.which_value}</div>
                      </div>
                      <div>
                        <div className="text-[7px] font-black text-zinc-700 uppercase mb-0.5">Shelf/Row</div>
                        <div className="text-[10px] text-zinc-400">{book.shelf_position} / {book.row_position}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[7px] font-black text-zinc-700 uppercase mb-0.5">Description</div>
                        <div className="text-[10px] text-zinc-500 italic leading-relaxed">{book.description || 'No description provided.'}</div>
                      </div>
                      {book.cover_page_url && (
                        <div className="col-span-2">
                          <div className="text-[7px] font-black text-zinc-700 uppercase mb-0.5">Cover URL</div>
                          <div className="text-[10px] text-blue-400 truncate underline">{book.cover_page_url}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: Current Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Record Identity</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Authority</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Assigned Cat.</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Classification</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Valuation</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Specs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-white mx-auto opacity-20" />
                      </td>
                    </tr>
                  ) : books.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-zinc-600 font-bold uppercase tracking-widest text-xs">
                        No encrypted records found in the database.
                      </td>
                    </tr>
                  ) : (
                    books.map((book) => (
                      <tr key={book.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6">
                          <div className="font-bold text-white text-sm leading-tight group-hover:text-white transition-colors">
                            {book.book_nomenclature}
                          </div>
                          <div className="text-[10px] text-zinc-600 font-bold mt-1 uppercase tracking-tighter flex items-center gap-2">
                            <span>Book No: {book.book_number}</span>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span style={{ color: getUserColor(book.added_by || '') }}>{book.added_by}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-zinc-400 text-sm font-medium">
                          {book.authority}
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                            {book.user_category || 'Malayalam'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                            {book.category}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-white text-sm font-bold">
                          {book.price ? `₹${book.price.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-zinc-500 font-bold text-xs">
                            {book.page_count} PAGES
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => startEditing(book)} className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteBook(book.id!)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
              ENTRY {page * pageSize + 1} — {Math.min((page + 1) * pageSize, totalCount)} OF {totalCount}
            </p>
            <div className="flex gap-3">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-3 rounded-xl bg-white/5 text-white disabled:opacity-20 border border-white/10 hover:bg-white/10 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-3 rounded-xl bg-white/5 text-white disabled:opacity-20 border border-white/10 hover:bg-white/10 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'add' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <BookForm />
        </div>
      ) : activeTab === 'users' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Create User Card */}
          <div className="lg:col-span-1">
            <div className="glass-card p-8 rounded-[2rem] border border-white/10 shadow-2xl sticky top-32">
              <div className="p-4 rounded-2xl bg-white text-black w-fit mb-6">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2 tracking-tight">Provision Authority</h3>
              <p className="text-zinc-500 text-sm font-medium mb-6 leading-relaxed">Assign new encrypted credentials to system operators.</p>
              
              <div className="mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-bold uppercase tracking-wider leading-loose">
                Note: Created users can log in immediately if "Confirm Email" is disabled in your Supabase Auth settings.
              </div>
              
              <form onSubmit={handleCreateUser} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Operator Name</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Enter Full Name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative">
                      <Shield className="absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                      <input
                        type="text"
                        required
                        value={newUserPhone}
                        onChange={(e) => setNewUserPhone(e.target.value)}
                        placeholder="+91 0000000000"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                      />
                    </div>
                  </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Assigned Categories</label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {USER_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                          newUserCategories.includes(cat) 
                            ? 'bg-white text-black border-white' 
                            : 'bg-white/5 text-zinc-500 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {/* Quick Add for Creation */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={quickAddCategory}
                      onChange={(e) => setQuickAddCategory(e.target.value)}
                      placeholder="New Category..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 text-[10px] font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickAddCategory('create')}
                      className="px-4 py-2 bg-white/5 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Start No.</label>
                    <input
                      type="number"
                      value={userStartNo}
                      onChange={(e) => setUserStartNo(e.target.value)}
                      placeholder="1"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">End No.</label>
                    <input
                      type="number"
                      value={userEndNo}
                      onChange={(e) => setUserEndNo(e.target.value)}
                      placeholder="200"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                  <button
                    type="submit"
                  disabled={creatingUser}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 transition-all mt-4 shadow-xl shadow-white/5 disabled:opacity-50 text-xs uppercase tracking-widest"
                >
                  {creatingUser ? 'Provisioning...' : 'Grant Access'}
                </button>
              </form>
            </div>
          </div>

          {/* User List Management */}
          <div className="lg:col-span-3 space-y-6">
            <div className="glass-card p-4 sm:p-10 rounded-[2rem] border border-white/5 min-h-[400px] overflow-hidden">
              <h4 className="text-white font-black text-lg mb-6 flex items-center gap-2">
                <Shield className="h-5 w-5" /> Authority Registry
              </h4>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-left">
                      <th className="px-6 pb-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Operator</th>
                      <th className="px-6 pb-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Phone</th>
                      <th className="px-6 pb-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Assigned Categories</th>
                      <th className="px-6 pb-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Range</th>
                      <th className="px-6 pb-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Role</th>
                      <th className="px-6 pb-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mx-auto" />
                        </td>
                      </tr>
                    ) : registeredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-zinc-500 text-sm">No operators registered.</td>
                      </tr>
                    ) : (
                      registeredUsers.map((user) => {
                        const userColor = getUserColor(user.phone_number)
                        return (
                          <tr key={user.id} className="group">
                            <td className="px-6 py-4 bg-white/[0.02] border-y border-l border-white/5 rounded-l-2xl">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${userColor}20`, color: userColor }}>
                                  <Users className="h-4 w-4" />
                                </div>
                                <span className="text-white font-bold text-sm">{user.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                              <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{user.phone_number}</span>
                            </td>
                            <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                              <div className="flex flex-wrap gap-1.5">
                                {(user.assigned_category || '').split(',').map((cat: string) => cat && (
                                  <span key={cat} className="px-2 py-0.5 rounded-md bg-white/5 text-[8px] font-black uppercase tracking-widest border border-white/5" style={{ color: userColor }}>
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{user.start_range} - {user.end_range}</span>
                            </td>
                            <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-white text-black' : 'bg-white/5 text-zinc-500'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 bg-white/[0.02] border-y border-r border-white/5 rounded-r-2xl text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => startEditingUser(user)} className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"><Edit2 className="h-4 w-4" /></button>
                                {user.phone_number !== '+91 9526569313' && (
                                  <button onClick={() => handleDeleteUser(user.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Trash2 className="h-4 w-4" /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (shown only on mobile) */}
              <div className="md:hidden space-y-4">
                {loadingUsers ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                  </div>
                ) : registeredUsers.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No other operators registered.</p>
                ) : (
                  registeredUsers.map((user) => {
                    const userColor = getUserColor(user.phone_number);
                    return (
                      <div key={user.id} className="flex flex-col p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div 
                              className="p-3 rounded-xl transition-colors"
                              style={{ backgroundColor: `${userColor}20`, color: userColor }}
                            >
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-white font-bold text-sm flex items-center gap-2">
                                {user.name}
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userColor }}></span>
                              </div>
                              <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <span>{user.phone_number}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-white text-black' : 'bg-white/5 text-zinc-500'}`}>
                              {user.role}
                            </span>
                            
                            <button 
                              onClick={() => startEditingUser(user)}
                              className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            {user.phone_number !== '+91 9526569313' && (
                              <button 
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {user.role !== 'admin' && (
                          <div className="flex flex-wrap gap-2 items-center pl-14">
                            {(user.assigned_category || '').split(',').map((cat: string) => cat && (
                              <span key={cat} className="px-2 py-1 rounded-md bg-white/5 text-[8px] font-black uppercase tracking-widest" style={{ color: userColor, borderColor: `${userColor}40`, borderWidth: 1 }}>
                                {cat}
                              </span>
                            ))}
                            <span className="w-1 h-1 rounded-full bg-white/20 mx-1" />
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                              Range: {user.start_range}-{user.end_range}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Language Management */}
          <div className="glass-card p-8 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="p-4 rounded-2xl bg-white text-black w-fit mb-6">
              <Globe className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tight">Manage Languages</h3>
            <p className="text-zinc-500 text-sm font-medium mb-8 leading-relaxed">Add or remove supported book languages.</p>
            
            <div className="flex gap-3 mb-8">
              <input
                type="text"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="New Language (e.g. Arabic)"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm font-medium"
              />
              <button
                onClick={() => handleAddSetting('language', newLanguage)}
                className="px-8 py-4 rounded-2xl bg-white text-black font-black hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                Add
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {loadingSettings ? (
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mx-auto" />
              ) : systemSettings.languages.length === 0 ? (
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest text-center py-10">No languages added yet.</p>
              ) : (
                systemSettings.languages.map((lang) => (
                  <div key={lang} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-all">
                    <span className="text-zinc-400 font-bold text-sm group-hover:text-white transition-colors">{lang}</span>
                    <button
                      onClick={() => handleDeleteSetting('language', lang)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* User Category Management */}
          <div className="glass-card p-8 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="p-4 rounded-2xl bg-white text-black w-fit mb-6">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tight">User Categories</h3>
            <p className="text-zinc-500 text-sm font-medium mb-8 leading-relaxed">Manage categories for user assignments.</p>
            
            <div className="flex gap-3 mb-8">
              <input
                type="text"
                value={newUserCategoryOption}
                onChange={(e) => setNewUserCategoryOption(e.target.value)}
                placeholder="New Category (e.g. Reference)"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm font-medium"
              />
              <button
                onClick={() => handleAddSetting('user_category', newUserCategoryOption)}
                className="px-8 py-4 rounded-2xl bg-white text-black font-black hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                Add
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {loadingSettings ? (
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mx-auto" />
              ) : systemSettings.userCategories.length === 0 ? (
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest text-center py-10">No user categories added yet.</p>
              ) : (
                systemSettings.userCategories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-all">
                    <span className="text-zinc-400 font-bold text-sm group-hover:text-white transition-colors">{cat}</span>
                    <button
                      onClick={() => handleDeleteSetting('user_category', cat)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Book Category Management */}
          <div className="glass-card p-8 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="p-4 rounded-2xl bg-white text-black w-fit mb-6">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tight">Book Categories</h3>
            <p className="text-zinc-500 text-sm font-medium mb-8 leading-relaxed">Manage categories for book classification.</p>
            
            <div className="flex gap-3 mb-8">
              <input
                type="text"
                value={newBookCategoryOption}
                onChange={(e) => setNewBookCategoryOption(e.target.value)}
                placeholder="New Category (e.g. History)"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm font-medium"
              />
              <button
                onClick={() => handleAddSetting('book_category', newBookCategoryOption)}
                className="px-8 py-4 rounded-2xl bg-white text-black font-black hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                Add
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {loadingSettings ? (
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mx-auto" />
              ) : systemSettings.bookCategories.length === 0 ? (
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest text-center py-10">No book categories added yet.</p>
              ) : (
                systemSettings.bookCategories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-all">
                    <span className="text-zinc-400 font-bold text-sm group-hover:text-white transition-colors">{cat}</span>
                    <button
                      onClick={() => handleDeleteSetting('book_category', cat)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SQL Preview Modal */}
      {sqlPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-5xl max-h-[85vh] flex flex-col rounded-[2.5rem] overflow-hidden border border-white/20 shadow-[0_0_100px_rgba(255,255,255,0.05)]">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight mb-1">Registry SQL Export</h3>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Database Insert Script</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={downloadSql}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl shadow-white/10"
                >
                  <Download className="h-4 w-4" /> Download .sql
                </button>
                <button
                  onClick={() => setSqlPreview(null)}
                  className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-8 overflow-auto bg-[#030303] font-mono text-xs leading-relaxed custom-scrollbar">
              <pre className="text-zinc-400 selection:bg-white/20 selection:text-white">{sqlPreview}</pre>
            </div>
          </div>
        </div>
      )}

      {/* JSON Preview Modal */}
      {jsonPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-5xl max-h-[85vh] flex flex-col rounded-[2.5rem] overflow-hidden border border-white/20 shadow-[0_0_100px_rgba(255,255,255,0.05)]">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight mb-1">Registry Export</h3>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Formatted JSON Object Array</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl shadow-white/10"
                >
                  <Download className="h-4 w-4" /> Download .json
                </button>
                <button
                  onClick={() => setJsonPreview(null)}
                  className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-8 overflow-auto bg-[#030303] font-mono text-xs leading-relaxed custom-scrollbar">
              <pre className="text-zinc-400 selection:bg-white/20 selection:text-white">{jsonPreview}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
