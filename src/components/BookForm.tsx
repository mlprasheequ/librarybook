import React, { useState, useEffect } from 'react'
import { useBooks } from '../hooks/useBooks'
import { Save, Table, Info, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { type Book, supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'

const EMPTY_ROW: Partial<Book> = {
  book_nomenclature: '',
  authority: '',
  price: 0,
  category: 'General',
  page_count: 0,
  serial_id: '',
  publisher: '',
  language: 'English',
  isbn: '',
  description: '',
  how_much_value: '',
  which_value: '',
  shelf_position: '',
  row_position: '',
  cover_page_url: ''
}

export const BookForm = () => {
  const { addBook, loading } = useBooks()
  const [languages, setLanguages] = useState<string[]>([])
  const [userCategories, setUserCategories] = useState<string[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [rows, setRows] = useState<Partial<Book>[]>([])
  const [activeRowIndex, setActiveRowIndex] = useState(0)
  const [fetching, setFetching] = useState(true)

  const [selectedUserCategory, setSelectedUserCategory] = useState<string>('Malayalam')
  const [jumpNumber, setJumpNumber] = useState('')

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseInt(jumpNumber)
    if (isNaN(num)) return

    const index = rows.findIndex(r => r.book_number === num)
    if (index !== -1) {
      setActiveRowIndex(index)
      setJumpNumber('')
      // On desktop, we might want to scroll to the row, but on mobile it switches the card
      const rowElement = document.querySelector(`[data-row="${index}"]`)
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      toast.error(`Book #${num} is not in your assigned range.`)
    }
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('biblio_user') || '{}')
    setCurrentUser(user)
    
    // Support multiple categories
    const categories = user.assigned_category ? user.assigned_category.split(',') : ['Malayalam']
    if (categories.length > 0) {
      setSelectedUserCategory(categories[0])
      fetchUserBooks(user, categories[0])
    } else {
      fetchUserBooks(user, 'Malayalam')
    }
    
    fetchSettings()
  }, [])

  const fetchUserBooks = async (user: any, userCategory: string) => {
    if (!user.phone_number) {
      setFetching(false)
      return
    }
    
    setFetching(true)
    try {
      let start = user.start_range || 0
      let end = user.end_range || 0

      // If admin, calculate the total range given to all users for THIS USER CATEGORY
      if (user.role === 'admin') {
        const { data: allUsers, error: usersError } = await supabase
          .from('portal_users')
          .select('start_range, end_range')
          .eq('role', 'operator')
          .ilike('assigned_category', `%${userCategory}%`)
        
        if (!usersError && allUsers && allUsers.length > 0) {
          const validEndRanges = allUsers.map(u => u.end_range).filter(r => r !== null && r !== undefined)
          const validStartRanges = allUsers.map(u => u.start_range).filter(r => r !== null && r !== undefined)
          
          if (validEndRanges.length > 0) {
            end = Math.max(...validEndRanges)
          }
          if (validStartRanges.length > 0) {
            start = Math.min(...validStartRanges)
          }
        } else {
          // If no operator ranges found, default to 1-100 for admin to allow entry
          start = 1
          end = 100
        }
      }

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_category', userCategory)
      
      if (error) throw error

      const rangeSize = Math.max(0, end - start + 1)
      
      const initialRows = Array(rangeSize).fill(null).map((_, i) => {
        const bookNum = start + i
        const existingBook = data?.find(b => b.book_number === bookNum)
        return existingBook || { ...EMPTY_ROW, book_number: bookNum, user_category: userCategory }
      })
      
      setRows(initialRows)
      
      // Find first empty row to start with
      const firstEmpty = initialRows.findIndex(r => !r.id)
      if (firstEmpty !== -1) setActiveRowIndex(firstEmpty)
    } catch (error) {
      console.error('Error fetching user books:', error)
    } finally {
      setFetching(false)
    }
  }

  const handleRowChange = (index: number, field: keyof Book, value: any) => {
    const updatedRows = [...rows]
    const row = updatedRows[index]
    
    // Auto-fill cover image URL if nomenclature is provided and cover URL is empty
    let updatedValue = value
    let extraUpdates: Partial<Book> = {}
    
    if (field === 'book_nomenclature' && value && !row.cover_page_url) {
      const encodedName = encodeURIComponent(value)
      extraUpdates.cover_page_url = `https://placehold.co/400x600/09090b/ffffff?text=${encodedName}`
    }

    const currentRow = { 
      ...row, 
      [field]: updatedValue,
      ...extraUpdates,
      isbn: row.book_number?.toString() || ''
    }
    updatedRows[index] = currentRow
    setRows(updatedRows)

    // Clear previous timeout for auto-save (Desktop only)
    if (saveTimeout) clearTimeout(saveTimeout)

    // Auto-save logic for desktop with debounce
    if (currentRow.book_nomenclature || currentRow.authority) {
      const timeout = setTimeout(async () => {
        const savedBook = await addBook(currentRow as Book, true)
        if (savedBook) {
          setRows(prevRows => {
            const newRows = [...prevRows]
            if (newRows[index]) {
              newRows[index] = {
                ...newRows[index],
                id: savedBook.id,
                created_at: savedBook.created_at,
                added_by: savedBook.added_by
              }
            }
            return newRows
          })
        }
      }, 1500) // 1.5s debounce for desktop
      setSaveTimeout(timeout)
    }
  }

  const [saveTimeout, setSaveTimeout] = useState<any>(null)

  const isRowComplete = (row: Partial<Book>) => {
    return !!(
      row.book_nomenclature && 
      row.authority && 
      row.category && 
      row.page_count !== undefined &&
      !isNaN(row.page_count)
    )
  }

  const saveCurrentAndNext = async () => {
    const currentRow = rows[activeRowIndex]
    if (!isRowComplete(currentRow)) return

    const savedBook = await addBook(currentRow as Book, false)
    if (savedBook) {
      setRows(prevRows => {
        const newRows = [...prevRows]
        newRows[activeRowIndex] = {
          ...newRows[activeRowIndex],
          id: savedBook.id,
          created_at: savedBook.created_at,
          added_by: savedBook.added_by
        }
        return newRows
      })
      
      if (activeRowIndex < rows.length - 1) {
        setActiveRowIndex(prev => prev + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        toast.success("All books in your range have been entered!")
      }
    }
  }

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('system_settings').select('*')
      if (error) {
        console.error('Settings fetch error:', error)
        throw error
      }
      
      if (data) {
        const langs = data.filter(s => s.type === 'language').map(s => s.value)
        const cats = data.filter(s => s.type === 'user_category').map(s => s.value)
        setLanguages(langs)
        setUserCategories(cats.length > 0 ? cats : ['Malayalam', 'Arabic', 'Reference'])
      } else {
        setLanguages([])
        setUserCategories(['Malayalam', 'Arabic', 'Reference'])
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setLanguages([]) 
      setUserCategories(['Malayalam', 'Arabic', 'Reference'])
    } finally {
      setLoadingSettings(false)
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Filter out completely empty rows if there are multiple
    const rowsToSave = rows.filter(row => row.book_nomenclature || row.authority)
    
    if (rowsToSave.length === 0) {
      toast.error("Please fill at least one book record.")
      return
    }

    // Validation for non-empty rows using our strict completion logic
    const invalidRowIndex = rowsToSave.findIndex(row => !isRowComplete(row))

    if (invalidRowIndex !== -1) {
      toast.error(`Please fill all required fields for Row ${invalidRowIndex + 1}`)
      return
    }

    let successCount = 0
    const loadingToast = toast.loading(`Registering ${rowsToSave.length} books...`)
    
    try {
      for (const row of rowsToSave) {
        const success = await addBook(row as Book, true)
        if (success) successCount++
      }

      if (successCount === rowsToSave.length) {
        toast.success(`Successfully registered ${successCount} books!`, { id: loadingToast })
        fetchUserBooks(currentUser, selectedUserCategory)
      } else {
        toast.error(`Registered ${successCount} out of ${rowsToSave.length} books.`, { id: loadingToast })
      }
    } catch (error) {
      toast.error("An error occurred during registration.", { id: loadingToast })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    const columns = [
      'book_nomenclature', 'authority', 'category', 'price', 'page_count', 
      'language', 'publisher', 
      'how_much_value', 'which_value', 'shelf_position', 'row_position', 
      'cover_page_url', 'description'
    ]
    const colIndex = columns.indexOf(field)

    if (e.key === 'ArrowDown' && index < rows.length - 1) {
      e.preventDefault()
      const nextInput = document.querySelector(`[data-row="${index + 1}"][data-col="${field}"]`) as HTMLElement
      nextInput?.focus()
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      const prevInput = document.querySelector(`[data-row="${index - 1}"][data-col="${field}"]`) as HTMLElement
      prevInput?.focus()
    } else if (e.key === 'ArrowRight' && colIndex < columns.length - 1) {
      // Only move if cursor is at the end of input or it's a select/number
      const target = e.target as HTMLInputElement
      if (target.selectionStart === target.value.length || target.type !== 'text') {
        e.preventDefault()
        const nextCol = columns[colIndex + 1]
        const nextInput = document.querySelector(`[data-row="${index}"][data-col="${nextCol}"]`) as HTMLElement
        nextInput?.focus()
      }
    } else if (e.key === 'ArrowLeft' && colIndex > 0) {
      // Only move if cursor is at the beginning
      const target = e.target as HTMLInputElement
      if (target.selectionStart === 0 || target.type !== 'text') {
        e.preventDefault()
        const prevCol = columns[colIndex - 1]
        const prevInput = document.querySelector(`[data-row="${index}"][data-col="${prevCol}"]`) as HTMLElement
        prevInput?.focus()
      }
    }
  }

  const inputClasses = (row: Partial<Book>) => {
    const isOwned = row.added_by === currentUser?.phone_number
    return `w-full bg-transparent border-none px-4 py-3 ${isOwned ? 'text-emerald-400 font-bold' : 'text-white'} placeholder:text-zinc-700 focus:ring-2 focus:ring-white/10 text-sm font-medium transition-all outline-none`
  }
  const headerClasses = "px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-r border-white/5 whitespace-nowrap min-w-[160px]"
  const cellClasses = "border-r border-white/5 relative group bg-white/[0.01] hover:bg-white/[0.03] transition-colors"

  const isAdmin = currentUser?.role === 'admin'
  const currentRow = rows[activeRowIndex]
  const isComplete = currentRow ? isRowComplete(currentRow) : false

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 text-white animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Loading Registry...</p>
      </div>
    )
  }

  if (!currentRow && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 mb-6">
          <Info className="h-10 w-10 text-zinc-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">No Range Assigned</h2>
        <p className="text-zinc-500 max-w-xs">Please contact the administrator to assign you a book number range.</p>
      </div>
    )
  }

  const renderAdminEmptyState = () => (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6 glass-card rounded-[2.5rem] border border-dashed border-white/10">
      <div className="p-4 rounded-2xl bg-white/5 mb-4">
        <Info className="h-8 w-8 text-zinc-600" />
      </div>
      <h3 className="text-lg font-black text-white mb-1 uppercase">Empty Classification</h3>
      <p className="text-zinc-500 text-xs font-medium max-w-[200px]">
        No users or ranges have been assigned to the <span className="text-white font-bold">{selectedUserCategory}</span> category yet.
      </p>
    </div>
  )

  return (
    <div className="max-w-full mx-auto px-1 sm:px-4 pb-6 animate-in fade-in duration-700">
      {/* --- MOBILE VIEW (Card based sequential entry) - Hidden for Admin --- */}
      <div className={`${isAdmin ? 'hidden' : 'lg:hidden'} max-w-sm mx-auto`}>
        {/* Jump to Number Search */}
        <div className="mb-4">
          <form onSubmit={handleJump} className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-white transition-colors" />
            <input
              type="number"
              value={jumpNumber}
              onChange={(e) => setJumpNumber(e.target.value)}
              placeholder="Jump to Book #"
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
            />
          </form>
        </div>

        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white text-black shadow-md">
              <Table className="h-3.5 w-3.5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tighter uppercase leading-none">
                {isAdmin ? 'Registry' : 'Entry'}
              </h1>
              {currentRow && (
                <p className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                  {activeRowIndex + 1} / {rows.length}
                </p>
              )}
            </div>
          </div>

          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 scale-90">
            {(isAdmin || (currentUser?.assigned_category?.split(',').length > 1)) && (isAdmin ? userCategories : (currentUser?.assigned_category?.split(',') || ['Malayalam'])).map((cat: string) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedUserCategory(cat)
                  fetchUserBooks(currentUser, cat)
                  setActiveRowIndex(0)
                }}
                className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${
                  selectedUserCategory === cat 
                    ? 'bg-white text-black' 
                    : 'text-zinc-500/50 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
            {(!isAdmin && currentUser?.assigned_category?.split(',').length === 1) && (
              <span className="px-2 py-0.5 text-emerald-500 text-[7px] font-black uppercase tracking-widest">
                {selectedUserCategory}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              disabled={activeRowIndex === 0 || !currentRow}
              onClick={() => setActiveRowIndex(prev => prev - 1)}
              className="p-1.5 rounded-md bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-10 transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={activeRowIndex === rows.length - 1 || !currentRow}
              onClick={() => setActiveRowIndex(prev => prev + 1)}
              className="p-1.5 rounded-md bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-10 transition-all"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!currentRow && isAdmin ? renderAdminEmptyState() : (
          <>
            {/* Prominent Book Number */}
            <div className="glass-card rounded-[1rem] border border-white/10 shadow-lg overflow-hidden mb-3">
              <div className="bg-white/[0.03] px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em]">Slot</span>
                {currentRow?.id && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[7px] font-black uppercase tracking-widest border border-emerald-500/20">
                    Registered
                  </span>
                )}
              </div>
              
              <div className="p-3 text-center">
                <div className="text-5xl font-black text-white leading-none tracking-tighter">
                  {currentRow?.book_number}
                </div>
              </div>
            </div>

            {/* Entry Form Card */}
            <div className="glass-card rounded-[1.2rem] border border-white/10 shadow-lg p-4 space-y-4">
              <div className="grid grid-cols-1 gap-3.5">
                {/* Required Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5 flex justify-between">
                      <span>Archive Nom. *</span>
                      {!currentRow?.book_nomenclature && <span className="text-red-500/40 italic font-medium lowercase scale-90">Required</span>}
                    </label>
                    <input
                      value={currentRow?.book_nomenclature || ''}
                      onChange={(e) => handleRowChange(activeRowIndex, 'book_nomenclature', e.target.value)}
                      placeholder="Nomenclature"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5 flex justify-between">
                      <span>Author *</span>
                      {!currentRow?.authority && <span className="text-red-500/40 italic font-medium lowercase scale-90">Required</span>}
                    </label>
                    <input
                      value={currentRow?.authority || ''}
                      onChange={(e) => handleRowChange(activeRowIndex, 'authority', e.target.value)}
                      placeholder="Author"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Cat. *</label>
                      <select
                        value={currentRow?.category || ''}
                        onChange={(e) => handleRowChange(activeRowIndex, 'category', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-white/10 transition-all appearance-none"
                      >
                        <option value="" disabled className="bg-zinc-900">Select</option>
                        {userCategories.map(cat => (
                          <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5 flex justify-between">
                        <span>Price *</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px]">₹</span>
                        <input
                          type="number"
                          value={currentRow?.price || ''}
                          onChange={(e) => handleRowChange(activeRowIndex, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          placeholder="0"
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-3 py-2 text-white text-xs font-black focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Pages *</label>
                      <input
                        type="number"
                        value={currentRow?.page_count || ''}
                        onChange={(e) => handleRowChange(activeRowIndex, 'page_count', e.target.value === '' ? 0 : parseInt(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Lang.</label>
                      <select
                        value={currentRow?.language || 'English'}
                        onChange={(e) => handleRowChange(activeRowIndex, 'language', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-white/10 transition-all appearance-none"
                      >
                        {languages.map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Secondary Fields */}
                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Publisher</label>
                    <input
                      value={currentRow?.publisher || ''}
                      onChange={(e) => handleRowChange(activeRowIndex, 'publisher', e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-[10px] focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Val / Unit</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={currentRow?.how_much_value || ''}
                        onChange={(e) => handleRowChange(activeRowIndex, 'how_much_value', e.target.value)}
                        placeholder="Amt"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[10px]"
                      />
                      <input
                        value={currentRow?.which_value || ''}
                        onChange={(e) => handleRowChange(activeRowIndex, 'which_value', e.target.value)}
                        placeholder="Unit"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[10px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Shelf / Row</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={currentRow?.shelf_position || ''}
                        onChange={(e) => handleRowChange(activeRowIndex, 'shelf_position', e.target.value)}
                        placeholder="S"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[10px]"
                      />
                      <input
                        value={currentRow?.row_position || ''}
                        onChange={(e) => handleRowChange(activeRowIndex, 'row_position', e.target.value)}
                        placeholder="R"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[10px]"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[7px] font-black text-zinc-500 mb-1 uppercase tracking-widest ml-0.5">Description</label>
                    <textarea
                      value={currentRow?.description || ''}
                      onChange={(e) => handleRowChange(activeRowIndex, 'description', e.target.value)}
                      placeholder="Notes..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-[10px] h-14 resize-none focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-1">
                {isComplete && (
                  <button
                    onClick={saveCurrentAndNext}
                    disabled={loading}
                    className="w-full bg-white text-black font-black py-3 rounded-xl hover:bg-zinc-200 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-tighter animate-in zoom-in duration-300"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Save & Next
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Mobile Helper Info */}
        <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10">
          <Info className="h-3 w-3 text-blue-400 shrink-0" />
          <p className="text-[8px] text-blue-400 font-medium leading-tight">
            Required fields marked with (*). Save button appears when valid.
          </p>
        </div>
      </div>

      {/* --- DESKTOP VIEW (Excel like table) - Always shown for Admin --- */}
      <div className={`${isAdmin ? 'block' : 'hidden lg:block'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white text-black shadow-xl shadow-white/10">
              <Table className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase">
                {isAdmin ? 'Master Registry' : 'Data Entry Portal'}
              </h1>
              {currentRow && (
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Assigned Range: {currentUser?.start_range} - {currentUser?.end_range}
                </p>
              )}
              {!isAdmin && currentUser?.assigned_category && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Cat:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                    {selectedUserCategory}
                  </span>
                  {currentUser.assigned_category.split(',').length > 1 && (
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">(Switchable)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Jump to Number Search */}
            <form onSubmit={handleJump} className="relative group min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-white transition-colors" />
              <input
                type="number"
                value={jumpNumber}
                onChange={(e) => setJumpNumber(e.target.value)}
                placeholder="Jump to Book #"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
              />
            </form>

            {(isAdmin || (currentUser?.assigned_category?.split(',').length > 1)) && (
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                {(isAdmin ? userCategories : currentUser?.assigned_category?.split(',')).map((cat: string) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedUserCategory(cat)
                      fetchUserBooks(currentUser, cat)
                    }}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      selectedUserCategory === cat 
                        ? 'bg-white text-black' 
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            
            <button
              onClick={handleSubmit}
              disabled={loading || !currentRow}
              className="bg-white text-black font-black px-10 py-4 rounded-2xl hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-xl shadow-white/10 disabled:opacity-20"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Finalize & Save All
            </button>
          </div>
        </div>

        {!currentRow && isAdmin ? renderAdminEmptyState() : (
          <div className="overflow-x-auto custom-scrollbar rounded-[2rem] border border-white/10 shadow-2xl bg-white/[0.02]">
            <table className="w-full text-left border-collapse min-w-[2800px]">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/10">
                  <th className="px-6 py-4 w-16 text-center border-r border-white/5 bg-white/[0.02]">
                    <span className="text-[10px] font-black text-zinc-500 uppercase">No.</span>
                  </th>
                  <th className={headerClasses}>Archive Nomenclature *</th>
                  <th className={headerClasses}>Primary Authority *</th>
                  <th className={headerClasses}>Category *</th>
                  <th className={headerClasses}>Price (INR)</th>
                  <th className={headerClasses}>Page Count *</th>
                  <th className={headerClasses}>Language</th>
                  <th className={headerClasses}>Publisher</th>
                  <th className={headerClasses}>Value Amt</th>
                  <th className={headerClasses}>Unit</th>
                  <th className={headerClasses}>Shelf</th>
                  <th className={headerClasses}>Row</th>
                  <th className={headerClasses}>Cover URL</th>
                  <th className={headerClasses}>Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-4 py-3 text-center border-r border-white/5 text-[10px] font-black text-white bg-white/[0.02] group-hover:bg-white/[0.05] transition-colors">
                      {row.book_number}
                    </td>
                    
                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="book_nomenclature"
                        value={row.book_nomenclature}
                        onChange={(e) => handleRowChange(index, 'book_nomenclature', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'book_nomenclature')}
                        placeholder="Archive Nom."
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="authority"
                        value={row.authority}
                        onChange={(e) => handleRowChange(index, 'authority', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'authority')}
                        placeholder="Author"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <select
                        data-row={index}
                        data-col="category"
                        value={row.category}
                        onChange={(e) => handleRowChange(index, 'category', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'category')}
                        className={`${inputClasses(row)} appearance-none cursor-pointer`}
                      >
                        {userCategories.map(cat => (
                          <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                        ))}
                      </select>
                    </td>

                    <td className={cellClasses}>
                      <div className="flex items-center px-4">
                        <span className={`font-bold mr-2 text-xs ${row.added_by === currentUser?.phone_number ? 'text-emerald-500' : 'text-zinc-600'}`}>₹</span>
                        <input
                          data-row={index}
                          data-col="price"
                          type="number"
                          value={row.price || ''}
                          onChange={(e) => handleRowChange(index, 'price', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, index, 'price')}
                          placeholder="0.00"
                          className={`w-full bg-transparent border-none p-0 ${row.added_by === currentUser?.phone_number ? 'text-emerald-400 font-bold' : 'text-white'} focus:ring-0 text-sm font-medium outline-none`}
                        />
                      </div>
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="page_count"
                        type="number"
                        value={row.page_count || ''}
                        onChange={(e) => handleRowChange(index, 'page_count', e.target.value === '' ? undefined : parseInt(e.target.value))}
                        onKeyDown={(e) => handleKeyDown(e, index, 'page_count')}
                        placeholder="0"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <select
                        data-row={index}
                        data-col="language"
                        value={row.language}
                        onChange={(e) => handleRowChange(index, 'language', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'language')}
                        className={`${inputClasses(row)} appearance-none cursor-pointer`}
                        disabled={loadingSettings}
                      >
                        {languages.map(lang => (
                          <option key={lang} value={lang} className="bg-zinc-900">{lang}</option>
                        ))}
                      </select>
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="publisher"
                        value={row.publisher}
                        onChange={(e) => handleRowChange(index, 'publisher', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'publisher')}
                        placeholder="Publisher"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="how_much_value"
                        value={row.how_much_value}
                        onChange={(e) => handleRowChange(index, 'how_much_value', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'how_much_value')}
                        placeholder="Value"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="which_value"
                        value={row.which_value}
                        onChange={(e) => handleRowChange(index, 'which_value', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'which_value')}
                        placeholder="Unit"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="shelf_position"
                        value={row.shelf_position}
                        onChange={(e) => handleRowChange(index, 'shelf_position', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'shelf_position')}
                        placeholder="Shelf"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="row_position"
                        value={row.row_position}
                        onChange={(e) => handleRowChange(index, 'row_position', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'row_position')}
                        placeholder="Row"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <input
                        data-row={index}
                        data-col="cover_page_url"
                        value={row.cover_page_url}
                        onChange={(e) => handleRowChange(index, 'cover_page_url', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'cover_page_url')}
                        placeholder="Cover URL"
                        className={inputClasses(row)}
                      />
                    </td>

                    <td className={cellClasses}>
                      <textarea
                        data-row={index}
                        data-col="description"
                        value={row.description}
                        onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'description')}
                        placeholder="Description"
                        className={`${inputClasses(row)} h-10 resize-none`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
