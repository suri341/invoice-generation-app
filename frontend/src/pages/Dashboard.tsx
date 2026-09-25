import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { customersApi, partsApi, invoicesApi } from '@/lib/api'
import { FileText, Users, Package, TrendingUp, Eye, EyeOff, Calendar, Clock, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function Dashboard() {
  const now = new Date()
  const [tempStartDate, setTempStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 16))
  const [tempEndDate, setTempEndDate] = useState(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16))
  const [startDate, setStartDate] = useState(tempStartDate)
  const [endDate, setEndDate] = useState(tempEndDate)
  const [showRevenue, setShowRevenue] = useState(false)
  const dateRange = { date_from: new Date(startDate).toISOString(), date_to: new Date(endDate).toISOString() }

  const setQuickRange = (range: string) => {
    const end = new Date()
    const start = new Date(end)
    if (range === 'today') start.setHours(0, 0, 0, 0)
    if (range === '7days') start.setDate(start.getDate() - 7)
    if (range === '30days') start.setDate(start.getDate() - 30)
    if (range === 'month') start.setDate(1)
    if (range === 'year') {
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
    }
    setTempStartDate(start.toISOString().slice(0, 16))
    setTempEndDate(end.toISOString().slice(0, 16))
  }

  const applyFilters = () => {
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
  }

  const resetFilters = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 16)
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    setTempStartDate(start)
    setTempEndDate(end)
    setStartDate(start)
    setEndDate(end)
  }
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll().then(res => res.data),
  })

  const { data: parts } = useQuery({
    queryKey: ['parts'],
    queryFn: () => partsApi.getAll().then(res => res.data),
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', dateRange.date_from, dateRange.date_to],
    queryFn: () => invoicesApi.getAll(dateRange).then(res => res.data),
  })

  const stats = [
    {
      title: 'Total Customers',
      value: customers?.length || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Total Parts',
      value: parts?.length || 0,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
      borderColor: 'border-green-200',
    },
    {
      title: 'Total Invoices',
      value: invoices?.length || 0,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Total Revenue',
      value: showRevenue ? formatCurrency(invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0) : '••••••',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100',
      borderColor: 'border-orange-200',
    },
  ]

  const recentInvoices = invoices?.slice(0, 5) || []

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Welcome to Jagannath Enterprises Invoice System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className={`border-2 ${stat.borderColor} shadow-lg hover:shadow-xl transition-shadow`}>
              <CardContent className={`p-6 ${stat.bgColor}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stat.value}
                      {stat.title === 'Total Revenue' && (
                        <button
                          type="button"
                          title={showRevenue ? 'Hide total revenue' : 'Show total revenue'}
                          aria-label={showRevenue ? 'Hide total revenue' : 'Show total revenue'}
                          onClick={() => setShowRevenue(!showRevenue)}
                          className="ml-2 align-middle text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          {showRevenue ? <Eye className="inline h-5 w-5" /> : <EyeOff className="inline h-5 w-5" />}
                        </button>
                      )}
                    </p>
                  </div>
                  <div className={`${stat.color} p-4 rounded-xl bg-white shadow-md`}>
                    <Icon className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-2 border-blue-200 shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Time Range Filter
            </CardTitle>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              IST Timezone
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">QUICK SELECT</label>
            <div className="flex flex-wrap gap-2">
              {[['today', 'Today'], ['7days', 'Last 7 days'], ['30days', 'Last 30 days'], ['month', 'This month'], ['year', 'This year']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuickRange(value)}
                  className="px-3 py-1.5 text-sm font-medium border-2 border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 hover:border-blue-500 transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">START DATE & TIME</label>
              <input
                aria-label="Start date and time"
                type="datetime-local"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">END DATE & TIME</label>
              <input
                aria-label="End date and time"
                type="datetime-local"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={applyFilters} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium">
              Apply Filter
            </Button>
            <Button onClick={resetFilters} variant="outline" className="border-2 border-gray-300 hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-purple-200 shadow-md">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Documents In Selected Period
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {recentInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No invoices yet. Create your first invoice!</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 hover:border-purple-300 transition-all">
                  <div>
                    <p className="font-bold text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-600">{invoice.customer.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-gray-900">{formatCurrency(invoice.total_amount)}</p>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${invoice.invoice_type === 'quotation' ? 'bg-amber-200 text-amber-800 border border-amber-300' : 'bg-blue-200 text-blue-800 border border-blue-300'}`}>
                      {invoice.invoice_type === 'quotation' ? 'QUOTATION' : 'TAX INVOICE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
