import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { invoicesApi } from '@/lib/api'
import { Plus, Search, Download, Eye, Trash2, Pencil, ArrowRight } from 'lucide-react'
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils'
import type { Invoice } from '@/types'

export default function Invoices() {
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
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

  if (isLoading) {
    return <div className="text-center py-12">Loading invoices...</div>
  }

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

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Input placeholder="Customer" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
            <select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
              <option value="">All types</option><option value="quotation">Quotation</option><option value="invoice">Tax invoice</option>
            </select>
            <Input aria-label="Filter from date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input aria-label="Filter to date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Input aria-label="Minimum amount" type="number" min="0" placeholder="Min amount" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
            <Input aria-label="Maximum amount" type="number" min="0" placeholder="Max amount" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
          </div>
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
                  {filteredInvoices.map((invoice: Invoice) => (
                    <tr id={`invoice-${invoice.id}`} key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                          <Button size="sm" variant="outline" title={`View ${invoice.invoice_number}`} aria-label={`View ${invoice.invoice_number}`} onClick={() => setSelectedInvoice(invoice)}>
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

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Details for ${selectedInvoice.invoice_number}`}>
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader><div className="flex items-center justify-between"><h3 className="text-xl font-semibold">{selectedInvoice.invoice_number}</h3><Button variant="outline" onClick={() => setSelectedInvoice(null)}>Close</Button></div></CardHeader>
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
