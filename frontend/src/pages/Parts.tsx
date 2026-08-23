import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { partsApi } from '@/lib/api'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PartModal from '@/components/PartModal'
import type { Part } from '@/types'

export default function Parts() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPart, setSelectedPart] = useState<Part | undefined>(undefined)
  const queryClient = useQueryClient()

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts', search, selectedCategory],
    queryFn: () => partsApi.getAll({ search, category: selectedCategory || undefined }).then(res => res.data),
  })

  const { data: categories } = useQuery({
    queryKey: ['part-categories'],
    queryFn: () => partsApi.getCategories().then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Part>) => partsApi.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] })
      queryClient.invalidateQueries({ queryKey: ['part-categories'] })
      setIsModalOpen(false)
      setSelectedPart(undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Part> }) =>
      partsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] })
      queryClient.invalidateQueries({ queryKey: ['part-categories'] })
      setIsModalOpen(false)
      setSelectedPart(undefined)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => partsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] })
      queryClient.invalidateQueries({ queryKey: ['part-categories'] })
    },
  })

  const handleSave = (data: Partial<Part>) => {
    if (selectedPart) {
      updateMutation.mutate({ id: selectedPart.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (part: Part) => {
    setSelectedPart(part)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedPart(undefined)
    setIsModalOpen(true)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading parts...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Rice Mill Parts</h2>
          <p className="text-gray-500 mt-1">Manage your parts inventory</p>
        </div>
        <Button className="flex items-center space-x-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          <span>Add Part</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search parts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories?.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {parts && parts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No parts found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Part Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">HSN Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parts?.map((part: Part) => (
                    <tr key={part.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{part.name}</p>
                          {part.description && (
                            <p className="text-sm text-gray-500 mt-1">{part.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {part.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{part.hsn_code || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{part.unit}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(part.price)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(part)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this part?')) {
                                deleteMutation.mutate(part.id)
                              }
                            }}
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

      <PartModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPart(undefined)
        }}
        onSave={handleSave}
        part={selectedPart}
        title={selectedPart ? 'Edit Part' : 'Add New Part'}
      />
    </div>
  )
}
