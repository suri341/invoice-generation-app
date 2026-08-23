import { Link, useLocation } from 'react-router-dom'
import { FileText, Users, Package, LayoutDashboard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/parts', label: 'Parts', icon: Package },
    { path: '/invoices', label: 'Invoices', icon: FileText },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Jagannath Enterprises</h1>
                <p className="text-xs text-gray-500">Invoice Management System</p>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <Link to="/invoices/create">
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>New Invoice</span>
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-600">
              <p><strong>Proprietor:</strong> K. Krishna</p>
              <p><strong>Phone:</strong> 8919575870</p>
            </div>
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} Jagannath Enterprises. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
