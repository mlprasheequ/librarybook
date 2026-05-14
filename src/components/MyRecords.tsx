import React, { useState, useEffect } from 'react'
import { useBooks } from '../hooks/useBooks'
import { Search, ChevronLeft, ChevronRight, Loader2, BookOpen, Trash2, Edit2, X, Save } from 'lucide-react'
import { type Book } from '../lib/supabaseClient'

export const MyRecords = () => {
  const { books, totalCount, fetchBooks, loading, deleteBook, updateBook } = useBooks()
  const [page, setPage] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<Book>>({})
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  const pageSize = 10

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBooks(page, pageSize, searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [page, searchTerm])

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }))
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
      setIsEditModalOpen(false)
      fetchBooks(page, pageSize, searchTerm)
    }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return
    const success = await deleteBook(id)
    if (success) {
      fetchBooks(page, pageSize, searchTerm)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-white text-black">
              <BookOpen className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
              My Records
            </h1>
          </div>
          <p className="text-zinc-500 font-medium">Review and edit your registered book entries.</p>
        </div>

        <div className="relative group min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="Search your records..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(0)
            }}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Records List */}
      <div className="glass-card rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-white mx-auto opacity-20" />
          </div>
        ) : books.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 font-bold uppercase tracking-widest text-xs">
            No records found.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {books.map((book) => (
              <div key={book.id} className="p-6 sm:p-8 hover:bg-white/[0.01] transition-colors group">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex gap-6">
                    <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/5 text-white">
                      <span className="text-xs font-black opacity-30 uppercase">No.</span>
                      <span className="text-xl font-black">{book.book_number}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                        {book.book_nomenclature}
                      </h3>
                      <p className="text-zinc-400 text-sm font-medium mb-3">{book.authority}</p>
                      <div className="flex flex-wrap gap-3">
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest border border-white/5">
                          {book.category}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest border border-white/5">
                          ₹{book.price}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest border border-white/5">
                          {book.page_count} Pages
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-start">
                    <button 
                      onClick={() => startEditing(book)}
                      className="p-3 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteBook(book.id!)}
                      className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
          Page {page + 1} of {totalPages || 1}
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

      {/* Edit Modal (Copied from AdminTable and simplified) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-white/10 shadow-2xl p-8 lg:p-12">
            <div className="flex justify-between items-start mb-10 pb-6 border-b border-white/5">
              <div>
                <h3 className="text-3xl font-black text-white tracking-tight mb-2">Edit Record</h3>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Book Number: {editFormData.book_number}</p>
              </div>
              <button onClick={cancelEditing} className="p-3 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Category *</label>
                <select
                  name="category"
                  value={editFormData.category || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  <option value="ٱلْكُتُب" className="bg-zinc-900">ٱلْكُتُب</option>
                  <option value="General" className="bg-zinc-900">General</option>
                  <option value="Reference" className="bg-zinc-900">Reference</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Price (INR)</label>
                <input
                  type="number"
                  name="price"
                  value={editFormData.price || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg font-black focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
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

              {/* Added missing fields for editability */}
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Publisher</label>
                <input
                  name="publisher"
                  value={editFormData.publisher || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 mb-2 uppercase tracking-widest ml-1">Language</label>
                <input
                  name="language"
                  value={editFormData.language || ''}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
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

              <div className="md:col-span-2">
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
                className="flex-1 bg-white text-black font-black py-5 rounded-[1.5rem] hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" /> Save Changes
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
    </div>
  )
}
