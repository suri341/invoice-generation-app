import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { customersApi, partsApi, invoicesApi } from '@/lib/api'
import { FileText, Users, Package, TrendingUp, Eye, EyeOff, RefreshCw, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function Dashboard() {
  const now = new Date()
  const [tempStartDate, setTempStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 16))
  const [tempEndDate, setTempEndDate] = useState(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16))
  const [startDate, setStartDate] = useState(tempStartDate)
  const [endDate, setEndDate] = useState(tempEndDate)
  const [showRevenue, setShowRevenue] = useState(false)
  const [selectedRange, setSelectedRange] = useState('1d')
  const [showCustom, setShowCustom] = useState(false)
  const dateRange = { date_from: new Date(startDate).toISOString(), date_to: new Date(endDate).toISOString() }

  const timeRanges = [
    { value: '5m', label: 'Last 5 minutes', minutes: 5 },
    { value: '15m', label: 'Last 15 minutes', minutes: 15 },
    { value: '30m', label: 'Last 30 minutes', minutes: 30 },
    { value: '1h', label: 'Last 1 hour', hours: 1 },
    { value: '3h', label: 'Last 3 hours', hours: 3 },
    { value: '6h', label: 'Last 6 hours', hours: 6 },
    { value: '12h', label: 'Last 12 hours', hours: 12 },
    { value: '1d', label: 'Last 1 day', days: 1 },
    { value: '3d', label: 'Last 3 days', days: 3 },
    { value: '1w', label: 'Last 1 week', days: 7 },
    { value: '1M', label: 'Last 1 month', days: 30 },
    { value: '3M', label: 'Last 3 months', days: 90 },
    { value: 'custom', label: 'Custom' },
  ]

  const setQuickRange = (range: string) => {
    const end = new Date()
    const start = new Date(end)

    const rangeConfig = timeRanges.find(r => r.value === range)
    if (!rangeConfig || range === 'custom') {
      setShowCustom(true)
      return
    }

    if (rangeConfig.minutes) {
      start.setMinutes(start.getMinutes() - rangeConfig.minutes)
    } else if (rangeConfig.hours) {
      start.setHours(start.getHours() - rangeConfig.hours)
    } else if (rangeConfig.days) {
      start.setDate(start.getDate() - rangeConfig.days)
    }

    setTempStartDate(start.toISOString().slice(0, 16))
    setTempEndDate(end.toISOString().slice(0, 16))
    setSelectedRange(range)
    setShowCustom(false)
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

  const quotationInvoiceMap = new Map<number, any[]>()
  invoices?.forEach(inv => {
    if (inv.invoice_type === 'invoice' && inv.source_quotation) {
      const quoId = inv.source_quotation.id
      if (!quotationInvoiceMap.has(quoId)) {
        quotationInvoiceMap.set(quoId, [])
      }
      quotationInvoiceMap.get(quoId)?.push(inv)
    }
  })

  const recentQuotations = invoices?.filter(inv => inv.invoice_type === 'quotation').slice(0, 5) || []

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

      <Card className="border border-gray-300 bg-gray-50">
        <CardContent className="p-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={selectedRange}
                onChange={(e) => setQuickRange(e.target.value)}
                className="h-8 pl-3 pr-8 text-sm border border-gray-300 rounded-md bg-white appearance-none cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRanges.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {showCustom && (
              <>
                <input
                  type="datetime-local"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="datetime-local"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}

            <Button onClick={applyFilters} size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 px-4">
              Apply
            </Button>
            <Button onClick={resetFilters} size="sm" variant="outline" className="h-8 px-3">
              <RefreshCw className="h-3 w-3" />
            </Button>
            <span className="text-xs text-gray-500 ml-auto">IST Timezone</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 py-3">
          <CardTitle className="text-base text-gray-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            Recent Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {recentQuotations.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm">No documents yet</p>
          ) : (
            recentQuotations.map((quotation) => {
              const converted = quotationInvoiceMap.get(quotation.id) || []
              return (
                <div key={quotation.id} className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200 text-sm">
                    <div>
                      <p className="font-bold text-gray-900">{quotation.invoice_number}</p>
                      <p className="text-xs text-gray-600">{quotation.customer.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(quotation.total_amount)}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                        QUOTATION
                      </span>
                    </div>
                  </div>
                  {converted.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-2 ml-4 bg-purple-50 rounded border border-purple-200 text-sm">
                      <div>
                        <p className="font-bold text-gray-700"><span className="text-gray-400 mr-1">└─</span>{invoice.invoice_number}</p>
                        <p className="text-xs text-gray-600">{invoice.customer.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(invoice.total_amount)}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                          INVOICE
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
