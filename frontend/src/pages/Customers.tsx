import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customersApi } from '@/lib/api'
import { Plus, Search, Mail, Phone, MapPin, Edit, Trash2 } from 'lucide-react'
import CustomerModal from '@/components/CustomerModal'
import type { Customer } from '@/types'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined)
  const queryClient = useQueryClient()

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.getAll({ search }).then(res => res.data),
  })

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

  if (isLoading) {
    return <div className="text-center py-12">Loading customers...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 mt-1">Manage your customer database</p>
        </div>
        <Button className="flex items-center space-x-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          <span>Add Customer</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers by name, company, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customers && customers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No customers found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers?.map((customer: Customer) => (
                <Card key={customer.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg text-gray-900">{customer.name}</h3>
                    {customer.company_name && (
                      <p className="text-sm text-gray-600 mt-1">{customer.company_name}</p>
                    )}

                    <div className="mt-4 space-y-2">
                      {customer.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="h-4 w-4 mr-2" />
                          {customer.email}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2" />
                        {customer.phone}
                      </div>
                      {customer.city && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-2" />
                          {customer.city}, {customer.state}
                        </div>
                      )}
                    </div>

                    {customer.gstin && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500">GSTIN</p>
                        <p className="text-sm font-mono text-gray-700">{customer.gstin}</p>
                      </div>
                    )}

                    <div className="mt-4 flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this customer?')) {
                            deleteMutation.mutate(customer.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}
