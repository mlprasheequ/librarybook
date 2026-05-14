import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { BookForm } from './components/BookForm'
import { AdminTable } from './components/AdminTable'
import { MyRecords } from './components/MyRecords'
import { Library, LayoutDashboard, LogOut, Key, History } from 'lucide-react'
import { supabase } from './lib/supabaseClient'

const AdminLogin = () => {
  const [phoneNumber, setPhoneNumber] = useState('+91 ')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Clean phone number for searching (remove spaces, dashes, etc)
      const cleanPhone = phoneNumber.replace(/\s+/g, '').trim()
      
      const { data, error } = await supabase
        .from('portal_users')
        .select('*')
      
      if (error) throw error

      // Find user by comparing cleaned phone numbers
      const user = data.find(u => u.phone_number.replace(/\s+/g, '') === cleanPhone)
      
      if (!user) {
        toast.error('Invalid phone number. Access denied.')
      } else {
        localStorage.setItem('biblio_user', JSON.stringify(user))
        window.location.reload()
        toast.success(`Welcome back, ${user.name}`)
      }
    } catch (err: any) {
      toast.error('Database connection error. Please run the SQL setup.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
      <div className="glass-card p-10 rounded-[2.5rem] w-full max-w-md border border-white/10 shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="p-5 rounded-3xl bg-white text-black">
            <Key className="h-8 w-8" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-white text-center mb-2 tracking-tight">System Access</h2>
        <p className="text-zinc-500 text-center mb-10 font-medium">Enter your registered phone number to open the panel.</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest ml-1">Phone Number</label>
            <input
              type="text"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 0000000000"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-zinc-200 transition-all mt-8 shadow-xl shadow-white/5 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(true)

  const handleLogout = () => {
    localStorage.removeItem('biblio_user')
    setSession(null)
    toast.error('Session expired or account removed')
  }

  useEffect(() => {
    const verifySession = async () => {
      const localUser = localStorage.getItem('biblio_user')
      if (localUser) {
        try {
          const user = JSON.parse(localUser)
          const { data, error } = await supabase
            .from('portal_users')
            .select('id, name, role, phone_number, assigned_category, start_range, end_range')
            .eq('id', user.id)
            .single()

          if (error || !data) {
            handleLogout()
          } else {
            // Update session with latest data from DB
            setSession(data)
            localStorage.setItem('biblio_user', JSON.stringify(data))
          }
        } catch (err) {
          handleLogout()
        }
      }
      setIsVerifying(false)
    }

    verifySession()

    // Periodic check every 5 minutes
    const interval = setInterval(verifySession, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Library className="h-12 w-12 text-white animate-pulse" />
          <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px]">Verifying Authority...</p>
        </div>
      </div>
    )
  }

  const manualLogout = () => {
    localStorage.removeItem('biblio_user')
    setSession(null)
    toast.success('Signed out')
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#050505] text-zinc-200 selection:bg-white/20 selection:text-white font-sans antialiased">
        <Toaster position="bottom-center" theme="dark" richColors />
        
        <nav className="border-b border-white/5 sticky top-0 bg-[#050505]/80 backdrop-blur-2xl z-50">
          <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-4 group">
              <div className="p-3 rounded-2xl bg-white text-black transform group-hover:rotate-12 transition-transform duration-500">
                <Library className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-2xl tracking-tighter text-white leading-none">BIBLIO</span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1">Registry Portal</span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-8">
              {session ? (
                <div className="flex items-center gap-2 sm:gap-4">
                  <Link to="/" className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-widest px-2 py-2 sm:px-0 sm:py-0">
                    <Library className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Entry</span>
                  </Link>
                  <Link to="/my-records" className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-widest px-2 py-2 sm:px-0 sm:py-0">
                    <History className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">History</span>
                  </Link>
                  {session.role === 'admin' && (
                    <Link to="/admin" className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-black px-3 py-2 sm:px-5 sm:py-3 rounded-xl bg-white hover:bg-zinc-200 transition-all uppercase tracking-widest">
                      <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Management</span>
                    </Link>
                  )}
                  <button 
                    onClick={manualLogout}
                    className="p-2 sm:p-3 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <Link to="/admin" className="text-[10px] sm:text-xs font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-widest border border-white/10 px-4 py-2 sm:px-5 sm:py-3 rounded-xl hover:bg-white/5">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-16 px-6">
          <Routes>
            <Route 
              path="/" 
              element={
                session ? <BookForm /> : <Navigate to="/admin" replace />
              } 
            />
            <Route 
              path="/my-records" 
              element={
                session ? <MyRecords /> : <Navigate to="/admin" replace />
              } 
            />
            <Route 
              path="/admin" 
              element={
                session ? <AdminTable /> : <AdminLogin />
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        <footer className="py-20 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                <Library className="h-4 w-4 text-zinc-400" />
              </div>
              <span className="font-bold text-zinc-500 text-sm tracking-widest">BIBLIO SYSTEM © 2026</span>
            </div>
            <div className="flex gap-8 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App
