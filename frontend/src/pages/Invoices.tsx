import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { invoicesApi } from '@/lib/api'
import { Plus, Search, Download, Eye, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils'
import type { Invoice } from '@/types'

export default function Invoices() {
  const [search, setSearch] = useState('')
  const [statusFilter] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', search, statusFilter],
    queryFn: () => invoicesApi.getAll({ search, status: statusFilter || undefined }).then(res => res.data),
  })

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
            <span>Create Invoice</span>
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
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Invoice #</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices?.map((invoice: Invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {invoice.invoice_number}
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
                          {invoice.invoice_type.toUpperCase()}
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
                          <Button size="sm" variant="outline">
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
    </div>
  )
}
