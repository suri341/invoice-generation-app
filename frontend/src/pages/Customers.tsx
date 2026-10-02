import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customersApi, invoicesApi } from '@/lib/api'
import { downloadBlob, formatCurrency } from '@/lib/utils'
import { Plus, Search, Mail, Phone, MapPin, Edit, Trash2, FileText, MessageCircle, Download, FileSpreadsheet } from 'lucide-react'
import CustomerModal from '@/components/CustomerModal'
import PaginationControls from '@/components/ui/PaginationControls'
import type { Customer } from '@/types'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined)
  const [historyCustomerId, setHistoryCustomerId] = useState<number | null>(null)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const queryClient = useQueryClient()

  const downloadMutation = useMutation({
    mutationFn: (params: { id: number; filename: string }) => invoicesApi.downloadPdf(params.id),
    onSuccess: (response, params) => {
      downloadBlob(response.data, params.filename)
    },
  })

  const exportMutation = useMutation({
    mutationFn: () => customersApi.exportExcel(),
    onSuccess: (response) => {
      downloadBlob(response.data, `customers_${new Date().toISOString().slice(0, 10)}.xlsx`)
    },
    onError: () => alert('Failed to download customers Excel report'),
  })

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.getAll({ search, limit: 1000 }).then(res => res.data),
  })

  const { data: customerDocuments } = useQuery({
    queryKey: ['invoices', 'customer', historyCustomerId],
    queryFn: () => invoicesApi.getAll({ customer_id: historyCustomerId ?? undefined, limit: 1000 }).then(res => res.data),
    enabled: historyCustomerId !== null,
  })

  const broadcastRecipients = customers?.filter(customer => customer.phone?.trim()).map(customer => ({
    name: customer.name,
    phone: customer.phone.trim(),
    url: `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(broadcastMessage)}`,
  })) || []

  const createMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => customersApi.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setIsModalOpen(false)
      setSelectedCustomer(undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) =>
      customersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setIsModalOpen(false)
      setSelectedCustomer(undefined)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  const handleSave = (data: Partial<Customer>) => {
    if (selectedCustomer) {
      updateMutation.mutate({ id: selectedCustomer.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedCustomer(undefined)
    setIsModalOpen(true)
  }

  // Filter customers by state
  const filteredCustomers = customers?.filter(customer => {
    if (stateFilter && customer.state !== stateFilter) {
      return false
    }
    return true
  })
  const totalPages = Math.max(1, Math.ceil((filteredCustomers?.length || 0) / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedCustomers = filteredCustomers?.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 mt-1">Manage your customer database</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center space-x-2" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>Download Excel</span>
          </Button>
          <Button className="flex items-center space-x-2" onClick={handleAddNew}>
            <Plus className="h-4 w-4" />
            <span>Add Customer</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers by name, company, or phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
            <div className="w-48">
              <select
                aria-label="Filter customers by state"
                value={stateFilter}
                onChange={(e) => { setStateFilter(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All States</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Telangana">Telangana</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Loading customers...</p>
          ) : filteredCustomers && filteredCustomers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No customers found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginatedCustomers?.map((customer: Customer) => (
                <Card key={customer.id} className="border border-indigo-200 hover:border-indigo-400 transition-colors bg-white">
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm leading-5 text-gray-900 break-words">{customer.name}</h3>
                    {customer.company_name && (
                      <p className="text-xs text-gray-600 break-words">{customer.company_name}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                      {customer.email && (
                        <div className="flex items-center min-w-0 break-all">
                          <Mail className="h-3 w-3 mr-1 shrink-0" />
                          {customer.email}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 mr-1 shrink-0" />
                        {customer.phone}
                      </div>
                      {(customer.city || customer.state) && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 shrink-0" />
                          {[customer.city, customer.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {customer.gstin && <span className="break-all">GSTIN: {customer.gstin}</span>}
                      {customer.customer_type && (
                        <span className="font-semibold text-blue-800">{customer.customer_type}</span>
                      )}
                      {customer.missionary_type && <span>Missionary: {customer.missionary_type}</span>}
                      {customer.tph && <span>TPH: {customer.tph}</span>}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => {
                        setHistoryPage(1)
                        setHistoryCustomerId(historyCustomerId === customer.id ? null : customer.id)
                      }}>
                        <FileText className="h-3 w-3 mr-1" />
                        Documents
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0 shrink-0"
                        aria-label={`Delete ${customer.name}`}
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this customer?')) {
                            deleteMutation.mutate(customer.id)
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {filteredCustomers && filteredCustomers.length > 0 && (
            <PaginationControls
              page={currentPage}
              pageSize={pageSize}
              totalItems={filteredCustomers.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            />
          )}
        </CardContent>
      </Card>

      {historyCustomerId !== null && (() => {
        const quotationInvoiceMap = new Map<number, any[]>()
        customerDocuments?.forEach(inv => {
          if (inv.invoice_type === 'invoice' && inv.source_quotation) {
            const quoId = inv.source_quotation.id
            if (!quotationInvoiceMap.has(quoId)) {
              quotationInvoiceMap.set(quoId, [])
            }
            quotationInvoiceMap.get(quoId)?.push(inv)
          }
        })

        const quotationIds = new Set(customerDocuments?.filter(d => d.invoice_type === 'quotation').map(d => d.id))
        const quotations = customerDocuments?.filter(d =>
          d.invoice_type === 'quotation' || !(d.source_quotation && quotationIds.has(d.source_quotation.id))
        ) || []
        const historyPageCount = Math.max(1, Math.ceil(quotations.length / historyPageSize))
        const currentHistoryPage = Math.min(historyPage, historyPageCount)
        const paginatedDocuments = quotations.slice(
          (currentHistoryPage - 1) * historyPageSize,
          currentHistoryPage * historyPageSize
        )

        return (
          <Card className="border border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Documents for {customers?.find(c => c.id === historyCustomerId)?.name || 'Customer'}
                </h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                  {customerDocuments?.length || 0} Doc{customerDocuments?.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {quotations.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No documents found</p>
              ) : (
                paginatedDocuments.map(quotation => {
                  if (quotation.invoice_type === 'invoice') {
                    return (
                      <div key={quotation.id} className="flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200">
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-700">{quotation.invoice_number}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                            INVOICE
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{formatCurrency(quotation.total_amount)}</span>
                          <button
                            type="button"
                            title="Download"
                            onClick={() => downloadMutation.mutate({ id: quotation.id, filename: `${quotation.invoice_number}.pdf` })}
                            disabled={downloadMutation.isPending}
                            className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  }
                  const converted = quotationInvoiceMap.get(quotation.id) || []
                  return (
                    <div key={quotation.id} className="space-y-1">
                      <div className="flex justify-between items-center p-2 bg-amber-50 rounded border border-amber-200">
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-900">{quotation.invoice_number}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                            QUOTATION
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{formatCurrency(quotation.total_amount)}</span>
                          <button
                            type="button"
                            title="Download"
                            onClick={() => downloadMutation.mutate({ id: quotation.id, filename: `${quotation.invoice_number}.pdf` })}
                            disabled={downloadMutation.isPending}
                            className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {converted.map((invoice: any) => (
                        <div key={invoice.id} className="flex justify-between items-center p-2 ml-4 bg-purple-50 rounded border border-purple-200">
                          <div className="flex-1">
                            <p className="font-bold text-sm text-gray-700">
                              <span className="text-gray-400 mr-1">└─</span>{invoice.invoice_number}
                            </p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                              INVOICE
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900">{formatCurrency(invoice.total_amount)}</span>
                            <button
                              type="button"
                              title="Download"
                              onClick={() => downloadMutation.mutate({ id: invoice.id, filename: `${invoice.invoice_number}.pdf` })}
                              disabled={downloadMutation.isPending}
                              className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
              {quotations.length > 0 && (
                <PaginationControls
                  page={currentHistoryPage}
                  pageSize={historyPageSize}
                  totalItems={quotations.length}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={(size) => { setHistoryPageSize(size); setHistoryPage(1) }}
                />
              )}
            </CardContent>
          </Card>
        )
      })()}

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedCustomer(undefined)
        }}
        onSave={handleSave}
        customer={selectedCustomer}
        title={selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
      />

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">WhatsApp broadcast preparation</h3>
          <p className="text-sm text-gray-500">Prepare individual wa.me links for customers with phone numbers. Nothing is sent automatically.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} rows={3} placeholder="Write the message to prepare..." className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{broadcastRecipients.length} recipient(s) with phone numbers</span>
            <span>{(customers?.length || 0) - broadcastRecipients.length} missing number(s)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {broadcastRecipients.map(recipient => (
              <a key={recipient.phone} href={broadcastMessage ? recipient.url : undefined} target="_blank" rel="noreferrer" className={`inline-flex items-center px-3 py-2 rounded-md text-sm ${broadcastMessage ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500 pointer-events-none'}`}>
                <MessageCircle className="h-4 w-4 mr-2" />{recipient.name}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
