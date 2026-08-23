import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customersApi, partsApi, invoicesApi } from '@/lib/api'
import { Plus, Trash2, Save } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { InvoiceItem, CreateInvoiceData } from '@/types'

export default function CreateInvoice() {
  const navigate = useNavigate()
  const [invoiceType, setInvoiceType] = useState<'invoice' | 'quotation'>('invoice')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [discountPercentage, setDiscountPercentage] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<InvoiceItem, 'id' | 'amount'>[]>([{
    part_name: '',
    description: '',
    quantity: 1,
    unit: 'Piece',
    unit_price: 0,
  }])

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll().then(res => res.data),
  })

  const { data: parts } = useQuery({
    queryKey: ['parts'],
    queryFn: () => partsApi.getAll().then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceData) => invoicesApi.create(data),
    onSuccess: () => {
      navigate('/invoices')
    },
  })

  const addItem = () => {
    setItems([...items, {
      part_name: '',
      description: '',
      quantity: 1,
      unit: 'Piece',
      unit_price: 0,
    }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const selectPart = (index: number, partId: number) => {
    const part = parts?.find(p => p.id === partId)
    if (part) {
      updateItem(index, 'part_id', part.id)
      updateItem(index, 'part_name', part.name)
      updateItem(index, 'description', part.description || '')
      updateItem(index, 'unit', part.unit)
      updateItem(index, 'unit_price', part.price)
    }
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const discountAmount = (subtotal * discountPercentage) / 100
    const subtotalAfterDiscount = subtotal - discountAmount
    const cgst = (subtotalAfterDiscount * 9) / 100
    const sgst = (subtotalAfterDiscount * 9) / 100
    return subtotalAfterDiscount + cgst + sgst
  }

  const handleSubmit = () => {
    if (!customerId || items.length === 0) {
      alert('Please select a customer and add at least one item')
      return
    }

    const data: CreateInvoiceData = {
      customer_id: customerId,
      invoice_type: invoiceType,
      discount_percentage: discountPercentage,
      notes,
      items,
    }

    createMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Create New Invoice</h2>
        <p className="text-gray-500 mt-1">Generate invoice or quotation for your customer</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Type
                  </label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value as 'invoice' | 'quotation')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="invoice">Invoice</option>
                    <option value="quotation">Quotation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={customerId || ''}
                    onChange={(e) => setCustomerId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Customer</option>
                    {customers?.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.company_name ? `(${customer.company_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items</CardTitle>
                <Button size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-4">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-gray-900">Item {index + 1}</h4>
                      {items.length > 1 && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Part (Optional)
                        </label>
                        <select
                          onChange={(e) => selectPart(index, Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Custom Item</option>
                          {parts?.map((part) => (
                            <option key={part.id} value={part.id}>
                              {part.name} - {formatCurrency(part.price)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Part Name *
                        </label>
                        <Input
                          value={item.part_name}
                          onChange={(e) => updateItem(index, 'part_name', e.target.value)}
                          placeholder="Enter part name"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Additional details"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity *
                        </label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unit
                        </label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unit Price *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount
                        </label>
                        <div className="px-3 py-2 bg-gray-100 rounded-md font-semibold">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{formatCurrency(calculateSubtotal())}</span>
              </div>

              {discountPercentage > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount ({discountPercentage}%):</span>
                  <span>-{formatCurrency((calculateSubtotal() * discountPercentage) / 100)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CGST (9%):</span>
                <span>{formatCurrency(((calculateSubtotal() - (calculateSubtotal() * discountPercentage) / 100) * 9) / 100)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SGST (9%):</span>
                <span>{formatCurrency(((calculateSubtotal() - (calculateSubtotal() * discountPercentage) / 100) * 9) / 100)}</span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !customerId || items.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/invoices')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
