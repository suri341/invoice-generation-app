import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { customersApi, partsApi, invoicesApi } from '@/lib/api'
import { FileText, Users, Package, TrendingUp, Eye, EyeOff } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function Dashboard() {
  const now = new Date()
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 16))
  const [endDate, setEndDate] = useState(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16))
  const [showRevenue, setShowRevenue] = useState(true)
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
    setStartDate(start.toISOString().slice(0, 16))
    setEndDate(end.toISOString().slice(0, 16))
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
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Parts',
      value: parts?.length || 0,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Invoices',
      value: invoices?.length || 0,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Revenue',
      value: showRevenue ? formatCurrency(invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0) : '••••••',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
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
          return <Card key={stat.title}><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">{stat.title}</p><p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}{stat.title === 'Total Revenue' && <button type="button" title={showRevenue ? 'Hide total revenue' : 'Show total revenue'} aria-label={showRevenue ? 'Hide total revenue' : 'Show total revenue'} onClick={() => setShowRevenue(!showRevenue)} className="ml-2 align-middle text-gray-500 hover:text-gray-900">{showRevenue ? <Eye className="inline h-4 w-4" /> : <EyeOff className="inline h-4 w-4" />}</button>}</p></div><div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}><Icon className="h-6 w-6" /></div></div></CardContent></Card>
        })}
      </div>

      <Card><CardContent className="p-4 space-y-3"><div className="flex flex-wrap gap-2">{[['today', 'Today'], ['7days', '7 days'], ['30days', '30 days'], ['month', 'This month'], ['year', 'This year']].map(([value, label]) => <button key={value} type="button" onClick={() => setQuickRange(value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">{label}</button>)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm text-gray-700">Start date/time<input aria-label="Start date and time" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></label><label className="text-sm text-gray-700">End date/time<input aria-label="End date and time" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></label></div></CardContent></Card>

      <Card><CardHeader><CardTitle>Documents In Selected Period</CardTitle></CardHeader><CardContent>{recentInvoices.length === 0 ? <p className="text-gray-500 text-center py-8">No invoices yet. Create your first invoice!</p> : <div className="space-y-4">{recentInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div><p className="font-medium text-gray-900">{invoice.invoice_number}</p><p className="text-sm text-gray-500">{invoice.customer.name}</p></div><div className="text-right"><p className="font-semibold text-gray-900">{formatCurrency(invoice.total_amount)}</p><span className={`text-xs px-2 py-1 rounded-full ${invoice.invoice_type === 'quotation' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{invoice.invoice_type === 'quotation' ? 'QUOTATION' : 'TAX INVOICE'}</span></div></div>)}</div>}</CardContent></Card>
    </div>
  )
}
