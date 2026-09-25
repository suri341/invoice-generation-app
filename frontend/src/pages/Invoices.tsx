import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { invoicesApi } from '@/lib/api'
import { Plus, Search, Download, Eye, Trash2, Pencil, ArrowRight, Filter, RefreshCw, Calendar, Network } from 'lucide-react'
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils'
import type { Invoice } from '@/types'

export default function Invoices() {
  const [search, setSearch] = useState('')
  const [tempSearch, setTempSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [tempCustomerFilter, setTempCustomerFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [tempTypeFilter, setTempTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [tempDateFrom, setTempDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tempDateTo, setTempDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [tempAmountMin, setTempAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [tempAmountMax, setTempAmountMax] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const queryClient = useQueryClient()

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getAll().then(res => res.data),
  })

  const filteredInvoices = invoices?.filter((invoice) => {
    const searchValue = search.toLowerCase()
    const matchesSearch = !searchValue || invoice.invoice_number.toLowerCase().includes(searchValue)
    const matchesCustomer = !customerFilter || invoice.customer.name.toLowerCase().includes(customerFilter.toLowerCase())
    const matchesType = !typeFilter || invoice.invoice_type === typeFilter
    const invoiceDate = invoice.invoice_date.slice(0, 10)
    const matchesFrom = !dateFrom || invoiceDate >= dateFrom
    const matchesTo = !dateTo || invoiceDate <= dateTo
    const matchesMin = !amountMin || invoice.total_amount >= Number(amountMin)
    const matchesMax = !amountMax || invoice.total_amount <= Number(amountMax)
    return matchesSearch && matchesCustomer && matchesType && matchesFrom && matchesTo && matchesMin && matchesMax
  }) || []

  const downloadMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.downloadPdf(id),
    onSuccess: (response, id) => {
      const invoice = invoices?.find(inv => inv.id === id)
      if (invoice) {
        downloadBlob(response.data, `${invoice.invoice_number}.pdf`)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const convertMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.convert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const applyFilters = () => {
    setSearch(tempSearch)
    setCustomerFilter(tempCustomerFilter)
    setTypeFilter(tempTypeFilter)
    setDateFrom(tempDateFrom)
    setDateTo(tempDateTo)
    setAmountMin(tempAmountMin)
    setAmountMax(tempAmountMax)
  }

  const resetFilters = () => {
    setTempSearch('')
    setTempCustomerFilter('')
    setTempTypeFilter('')
    setTempDateFrom('')
    setTempDateTo('')
    setTempAmountMin('')
    setTempAmountMax('')
    setSearch('')
    setCustomerFilter('')
    setTypeFilter('')
    setDateFrom('')
    setDateTo('')
    setAmountMin('')
    setAmountMax('')
  }

  const handlePreview = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowPreview(true)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading invoices...</div>
  }

  const quotationInvoiceMap = new Map<number, Invoice[]>()
  invoices?.forEach(inv => {
    if (inv.invoice_type === 'invoice' && inv.source_quotation) {
      const quoId = inv.source_quotation.id
      if (!quotationInvoiceMap.has(quoId)) {
        quotationInvoiceMap.set(quoId, [])
      }
      quotationInvoiceMap.get(quoId)?.push(inv)
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Invoices & Quotations</h2>
          <p className="text-gray-500 mt-1">Manage your invoices and quotations</p>
        </div>
        <Link to="/invoices/create">
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create Quotation</span>
          </Button>
        </Link>
      </div>

      <Card className="border-2 border-indigo-200 shadow-md">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" />
              Filter Documents
            </CardTitle>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              IST Timezone
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">SEARCH</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search invoices..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  className="pl-10 border-2 border-gray-300 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">CUSTOMER</label>
              <Input
                placeholder="Filter by customer"
                value={tempCustomerFilter}
                onChange={(e) => setTempCustomerFilter(e.target.value)}
                className="border-2 border-gray-300 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">DOCUMENT TYPE</label>
              <select
                aria-label="Filter by type"
                value={tempTypeFilter}
                onChange={(e) => setTempTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-md focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">All types</option>
                <option value="quotation">Quotation</option>
                <option value="invoice">Tax invoice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">FROM DATE</label>
              <Input
                aria-label="Filter from date"
                type="date"
                value={tempDateFrom}
                onChange={(e) => setTempDateFrom(e.target.value)}
                className="border-2 border-gray-300 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">TO DATE</label>
              <Input
                aria-label="Filter to date"
                type="date"
                value={tempDateTo}
                onChange={(e) => setTempDateTo(e.target.value)}
                className="border-2 border-gray-300 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 block">AMOUNT RANGE</label>
              <div className="flex gap-2">
                <Input
                  aria-label="Minimum amount"
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={tempAmountMin}
                  onChange={(e) => setTempAmountMin(e.target.value)}
                  className="border-2 border-gray-300 focus:border-indigo-500"
                />
                <Input
                  aria-label="Maximum amount"
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={tempAmountMax}
                  onChange={(e) => setTempAmountMax(e.target.value)}
                  className="border-2 border-gray-300 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={applyFilters} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              Apply Filters
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
            <Network className="h-5 w-5 text-purple-600" />
            Quotation to Invoice Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredInvoices.filter(inv => inv.invoice_type === 'quotation' && quotationInvoiceMap.has(inv.id)).length === 0 ? (
            <p className="text-gray-500 text-center py-4">No quotation-to-invoice conversions found</p>
          ) : (
            <div className="space-y-4">
              {filteredInvoices
                .filter(inv => inv.invoice_type === 'quotation' && quotationInvoiceMap.has(inv.id))
                .map(quotation => (
                  <div key={quotation.id} className="p-4 bg-gradient-to-r from-amber-50 to-purple-50 rounded-lg border-2 border-amber-300">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-200 text-amber-800 px-3 py-2 rounded-lg font-bold border-2 border-amber-400">
                        {quotation.invoice_number}
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-600" />
                      <div className="flex flex-wrap gap-2">
                        {quotationInvoiceMap.get(quotation.id)?.map(invoice => (
                          <div key={invoice.id} className="bg-purple-200 text-purple-800 px-3 py-2 rounded-lg font-bold border-2 border-purple-400">
                            {invoice.invoice_number}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-200 shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle className="text-gray-800">All Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No invoices found</p>
              <Link to="/invoices/create">
                <Button>Create Your First Invoice</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Document #</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice: Invoice, index: number) => (
                    <tr id={`invoice-${invoice.id}`} key={invoice.id} className={`border-b-2 border-gray-200 transition-all ${index % 2 === 0 ? 'bg-gradient-to-r from-blue-50/30 to-purple-50/30' : 'bg-white'} hover:bg-gradient-to-r hover:from-indigo-100/50 hover:to-purple-100/50`}>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {invoice.invoice_number}
                        {invoice.source_quotation && <Link to={`/invoices#invoice-${invoice.source_quotation.id}`} className="block text-xs text-blue-600 hover:underline">From {invoice.source_quotation.invoice_number}</Link>}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{invoice.customer.name}</p>
                          {invoice.customer.company_name && (
                            <p className="text-sm text-gray-500">{invoice.customer.company_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          invoice.invoice_type === 'invoice'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {invoice.invoice_type === 'quotation' ? 'QUOTATION' : 'TAX INVOICE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button size="sm" variant="outline" title={`View ${invoice.invoice_number}`} aria-label={`View ${invoice.invoice_number}`} onClick={() => handlePreview(invoice)} className="hover:bg-blue-50 hover:border-blue-400">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadMutation.mutate(invoice.id)}
                            disabled={downloadMutation.isPending}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {invoice.invoice_type === 'quotation' && (
                            <>
                              <Link to={`/invoices/${invoice.id}/edit`}>
                                <Button size="sm" variant="outline" title="Edit quotation"><Pencil className="h-4 w-4" /></Button>
                              </Link>
                              <Button size="sm" variant="outline" title="Convert quotation to tax invoice" onClick={() => convertMutation.mutate(invoice.id)} disabled={convertMutation.isPending}>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this invoice?')) {
                                deleteMutation.mutate(invoice.id)
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedInvoice && showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Details for ${selectedInvoice.invoice_number}`}>
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-4 border-indigo-300 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">{selectedInvoice.invoice_number}</h3>
                <Button variant="outline" onClick={() => { setSelectedInvoice(null); setShowPreview(false); }} className="border-2 border-gray-300 hover:bg-red-50 hover:border-red-400">
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm"><p><strong>Customer:</strong> {selectedInvoice.customer.name}</p><p><strong>Type:</strong> {selectedInvoice.invoice_type === 'quotation' ? 'Quotation' : 'Tax invoice'}</p><p><strong>Date:</strong> {formatDate(selectedInvoice.invoice_date)}</p><p><strong>Total:</strong> {formatCurrency(selectedInvoice.total_amount)}</p></div>
              <div className="border-t pt-3"><h4 className="font-semibold mb-2">Items</h4>{selectedInvoice.items.map(item => <div key={item.id ?? item.part_name} className="flex justify-between border-b py-2 text-sm"><span>{item.part_name} x {item.quantity}</span><span>{formatCurrency(item.amount)}</span></div>)}</div>
              <Button onClick={() => downloadMutation.mutate(selectedInvoice.id)} disabled={downloadMutation.isPending}><Download className="h-4 w-4 mr-2" />Download PDF</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
