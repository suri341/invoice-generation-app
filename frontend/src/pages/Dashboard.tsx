import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PaginationControls from '@/components/ui/PaginationControls'
import { customersApi, partsApi, invoicesApi } from '@/lib/api'
import { FileText, Users, Package, TrendingUp, Eye, EyeOff, RefreshCw, ChevronDown, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import axios from 'axios'

// datetime-local inputs expect local time; toISOString() is UTC and shifted the range by the IST offset
const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function Dashboard() {
  // Initialize with "None" filter to show all data by default
  const veryOldDate = toLocalInput(new Date(2020, 0, 1))
  const farFutureDate = toLocalInput(new Date(2099, 11, 31, 23, 59))
  const [tempStartDate, setTempStartDate] = useState(veryOldDate)
  const [tempEndDate, setTempEndDate] = useState(farFutureDate)
  const [startDate, setStartDate] = useState(veryOldDate)
  const [endDate, setEndDate] = useState(farFutureDate)
  const [showRevenue, setShowRevenue] = useState(false)
  const [recentPage, setRecentPage] = useState(1)
  const [recentPageSize, setRecentPageSize] = useState(10)
  const [selectedRange, setSelectedRange] = useState('none')
  const [showCustom, setShowCustom] = useState(false)
  // End minute is inclusive
  const dateRange = { date_from: new Date(startDate).toISOString(), date_to: new Date(new Date(endDate).getTime() + 59999).toISOString() }

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportCustom, setReportCustom] = useState(false)
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  const timeRanges = [
    { value: 'none', label: 'None' },
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
    const rangeConfig = timeRanges.find(r => r.value === range)

    // Handle "None" - show all data
    if (range === 'none') {
      const startStr = toLocalInput(new Date(2020, 0, 1))
      const endStr = toLocalInput(new Date(2099, 11, 31, 23, 59))
      setTempStartDate(startStr)
      setTempEndDate(endStr)
      setStartDate(startStr)
      setEndDate(endStr)
      setRecentPage(1)
      setSelectedRange(range)
      setShowCustom(false)
      return
    }

    // Handle "Custom"
    if (!rangeConfig || range === 'custom') {
      setShowCustom(true)
      setSelectedRange(range)
      return
    }

    // Calculate time range
    const end = new Date()
    const start = new Date(end)

    if (rangeConfig.minutes) {
      start.setMinutes(start.getMinutes() - rangeConfig.minutes)
    } else if (rangeConfig.hours) {
      start.setHours(start.getHours() - rangeConfig.hours)
    } else if (rangeConfig.days) {
      start.setDate(start.getDate() - rangeConfig.days)
      start.setHours(0, 0, 0, 0) // Start of day
      end.setHours(23, 59, 59, 999) // End of current day
    }

    const startStr = toLocalInput(start)
    const endStr = toLocalInput(end)

    // Immediately apply filters like AWS CloudWatch (no need to click Apply)
    setTempStartDate(startStr)
    setTempEndDate(endStr)
    setStartDate(startStr)
    setEndDate(endStr)
    setRecentPage(1)
    setSelectedRange(range)
    setShowCustom(false)
  }

  const applyFilters = () => {
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
    setRecentPage(1)
  }

  const resetFilters = () => {
    // Reset to "None" filter (show all data)
    const veryOldDate = toLocalInput(new Date(2020, 0, 1))
    const farFutureDate = toLocalInput(new Date(2099, 11, 31, 23, 59))
    setTempStartDate(veryOldDate)
    setTempEndDate(farFutureDate)
    setStartDate(veryOldDate)
    setEndDate(farFutureDate)
    setRecentPage(1)
    setSelectedRange('none')
    setShowCustom(false)
  }

  const downloadMonthlyReport = async () => {
    try {
      // Ranges are built in local time so documents near midnight IST land in the right period
      let from: Date
      let to: Date
      if (reportCustom && reportStartDate && reportEndDate) {
        const [sy, sm, sd] = reportStartDate.split('-').map(Number)
        const [ey, em, ed] = reportEndDate.split('-').map(Number)
        from = new Date(sy, sm - 1, sd)
        to = new Date(ey, em - 1, ed + 1)
      } else {
        from = new Date(reportYear, reportMonth - 1, 1)
        to = new Date(reportYear, reportMonth, 1)
      }
      const url = `/api/reports/monthly?date_from=${encodeURIComponent(from.toISOString())}&date_to=${encodeURIComponent(to.toISOString())}`

      const response = await axios.get(url, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'text/csv' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = reportCustom
        ? `monthly_report_${reportStartDate}_to_${reportEndDate}.csv`
        : `monthly_report_${reportYear}-${String(reportMonth).padStart(2, '0')}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Error downloading report:', error)
      alert('Failed to download report')
    }
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
    queryFn: () => invoicesApi.getAll({ ...dateRange, limit: 1000 }).then(res => res.data),
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
      title: 'Total Documents',
      value: invoices?.length || 0,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Total Revenue',
      value: showRevenue ? formatCurrency(invoices?.filter(inv => inv.invoice_type === 'invoice').reduce((sum, inv) => sum + inv.total_amount, 0) || 0) : '••••••',
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

  const quotationIds = new Set(invoices?.filter(inv => inv.invoice_type === 'quotation').map(inv => inv.id))
  // Invoices whose quotation was deleted are shown as top-level documents
  const recentQuotations = invoices?.filter(inv =>
    inv.invoice_type === 'quotation' || !(inv.source_quotation && quotationIds.has(inv.source_quotation.id))
  ) || []
  const recentPageCount = Math.max(1, Math.ceil(recentQuotations.length / recentPageSize))
  const currentRecentPage = Math.min(recentPage, recentPageCount)
  const paginatedRecentQuotations = recentQuotations.slice(
    (currentRecentPage - 1) * recentPageSize,
    currentRecentPage * recentPageSize
  )

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
            paginatedRecentQuotations.map((quotation) => {
              if (quotation.invoice_type === 'invoice') {
                return (
                  <div key={quotation.id} className="flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-200 text-sm">
                    <div>
                      <p className="font-bold text-gray-700">{quotation.invoice_number}</p>
                      <p className="text-xs text-gray-600">{quotation.customer.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(quotation.total_amount)}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                        INVOICE
                      </span>
                    </div>
                  </div>
                )
              }
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
          {recentQuotations.length > 0 && (
            <PaginationControls
              page={currentRecentPage}
              pageSize={recentPageSize}
              totalItems={recentQuotations.length}
              onPageChange={setRecentPage}
              onPageSizeChange={(size) => { setRecentPageSize(size); setRecentPage(1) }}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 py-3">
          <CardTitle className="text-base text-gray-800 flex items-center gap-2">
            <Download className="h-4 w-4 text-green-600" />
            Monthly Report Download
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-gray-600 mb-4">
            Download a comprehensive report with all quotations and invoices including customer details
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={!reportCustom}
                  onChange={() => setReportCustom(false)}
                  className="mr-2"
                />
                <span className="text-sm">Select Month</span>
              </label>
              <label className="inline-flex items-center ml-4">
                <input
                  type="radio"
                  checked={reportCustom}
                  onChange={() => setReportCustom(true)}
                  className="mr-2"
                />
                <span className="text-sm">Custom Date Range</span>
              </label>
            </div>

            {!reportCustom ? (
              <div className="flex gap-2">
                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 self-center">to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <Button
              onClick={downloadMonthlyReport}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              disabled={reportCustom && (!reportStartDate || !reportEndDate)}
            >
              <Download className="h-4 w-4" />
              Download Report (CSV)
            </Button>

            <div className="text-xs text-gray-500 space-y-1">
              <p>Report includes:</p>
              <ul className="list-disc list-inside pl-2">
                <li>All quotations and invoices for selected period</li>
                <li>Customer names, company names, phone numbers</li>
                <li>Customer types and missionary information</li>
                <li>Quotation → Invoice hierarchy (tree structure)</li>
                <li>Tax details (CGST, SGST, IGST)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
