import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { invoicesApi } from '@/lib/api'
import { Search, Download, Eye, Trash2, Pencil, ArrowRight, RefreshCw } from 'lucide-react'
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
      </div>

      <Card className="border border-indigo-200">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[150px]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>

            <Input
              placeholder="Customer"
              value={tempCustomerFilter}
              onChange={(e) => setTempCustomerFilter(e.target.value)}
              className="w-32 h-8 text-sm"
            />

            <select
              aria-label="Type"
              value={tempTypeFilter}
              onChange={(e) => setTempTypeFilter(e.target.value)}
              className="w-32 h-8 px-2 text-sm border border-gray-300 rounded-md"
            >
              <option value="">All types</option>
              <option value="quotation">Quotation</option>
              <option value="invoice">Invoice</option>
            </select>

            <Input
              aria-label="From date"
              type="date"
              value={tempDateFrom}
              onChange={(e) => setTempDateFrom(e.target.value)}
              className="w-36 h-8 text-sm"
            />

            <Input
              aria-label="To date"
              type="date"
              value={tempDateTo}
              onChange={(e) => setTempDateTo(e.target.value)}
              className="w-36 h-8 text-sm"
            />

            <Input
              aria-label="Min amount"
              type="number"
              placeholder="Min"
              value={tempAmountMin}
              onChange={(e) => setTempAmountMin(e.target.value)}
              className="w-24 h-8 text-sm"
            />

            <Input
              aria-label="Max amount"
              type="number"
              placeholder="Max"
              value={tempAmountMax}
              onChange={(e) => setTempAmountMax(e.target.value)}
              className="w-24 h-8 text-sm"
            />

            <Button onClick={applyFilters} size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700">
              Apply
            </Button>
            <Button onClick={resetFilters} size="sm" variant="outline" className="h-8">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
        </Card>


      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {invoices && invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No documents found</p>
              <Link to="/invoices/create">
                <Button>Create Your First Quotation</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Document #</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Date</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Amount</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.filter(inv => inv.invoice_type === 'quotation').map((quotation: Invoice) => {
                    const convertedInvoices = quotationInvoiceMap.get(quotation.id) || []
                    return (
                      <>
                        <tr key={quotation.id} id={`invoice-${quotation.id}`} className="border-b border-gray-100 hover:bg-amber-50">
                          <td className="py-2 px-3 font-medium text-gray-900">
                            {quotation.invoice_number}
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-gray-900">{quotation.customer.name}</p>
                            {quotation.customer.company_name && (
                              <p className="text-xs text-gray-500">{quotation.customer.company_name}</p>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-semibold">
                              QUOTATION
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {formatDate(quotation.invoice_date)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-900">
                            {formatCurrency(quotation.total_amount)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button size="sm" variant="outline" title="View" onClick={() => handlePreview(quotation)} className="h-7 w-7 p-0">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                title="Download"
                                onClick={() => downloadMutation.mutate(quotation.id)}
                                disabled={downloadMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Link to={`/invoices/${quotation.id}/edit`}>
                                <Button size="sm" variant="outline" title="Edit" className="h-7 w-7 p-0">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                title="Convert to invoice"
                                onClick={() => convertMutation.mutate(quotation.id)}
                                disabled={convertMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                title="Delete"
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this quotation?')) {
                                    deleteMutation.mutate(quotation.id)
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {convertedInvoices.map((invoice: Invoice) => (
                          <tr key={invoice.id} id={`invoice-${invoice.id}`} className="border-b border-gray-100 hover:bg-purple-50 bg-purple-50/30">
                            <td className="py-2 px-3 pl-8 font-medium text-gray-700">
                              <span className="mr-2 text-gray-400">└─</span>
                              {invoice.invoice_number}
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-medium text-gray-900">{invoice.customer.name}</p>
                              {invoice.customer.company_name && (
                                <p className="text-xs text-gray-500">{invoice.customer.company_name}</p>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-semibold">
                                TAX INVOICE
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-600">
                              {formatDate(invoice.invoice_date)}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900">
                              {formatCurrency(invoice.total_amount)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex justify-end space-x-1">
                                <Button size="sm" variant="outline" title="View" onClick={() => handlePreview(invoice)} className="h-7 w-7 p-0">
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Download"
                                  onClick={() => downloadMutation.mutate(invoice.id)}
                                  disabled={downloadMutation.isPending}
                                  className="h-7 w-7 p-0"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  title="Delete"
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this invoice?')) {
                                      deleteMutation.mutate(invoice.id)
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                  className="h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
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
