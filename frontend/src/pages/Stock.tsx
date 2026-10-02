import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { partsApi } from '@/lib/api'
import { Search, Save } from 'lucide-react'
import type { Part } from '@/types'

export default function Stock() {
  const [search, setSearch] = useState('')
  const [edits, setEdits] = useState<Record<number, string>>({})
  const queryClient = useQueryClient()

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts', 'stock', search],
    queryFn: () => partsApi.getAll({ search, limit: 1000 }).then(res => res.data),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) => partsApi.updateStock(id, quantity),
    onSuccess: (_, { id }) => {
      setEdits(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['parts'] })
    },
    onError: () => alert('Failed to update stock'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Parts Stock (Live)</h2>
        <p className="text-gray-500 mt-1">Units available with us. Stock is reduced automatically when a quotation is converted to an invoice.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search parts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Loading stock...</p>
          ) : parts && parts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No parts found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Part Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">In Stock</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Update Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {parts?.map((part: Part) => {
                    const edited = edits[part.id]
                    return (
                      <tr key={part.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{part.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{part.category}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{part.unit}</td>
                        <td className={`py-3 px-4 text-right font-semibold ${part.stock_quantity > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {part.stock_quantity}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end items-center gap-2">
                            <Input
                              type="number"
                              step="any"
                              aria-label={`Stock for ${part.name}`}
                              value={edited ?? String(part.stock_quantity)}
                              onChange={(e) => setEdits({ ...edits, [part.id]: e.target.value })}
                              className="w-28 h-8 text-right"
                            />
                            <Button
                              size="sm"
                              onClick={() => saveMutation.mutate({ id: part.id, quantity: Number(edited) })}
                              disabled={edited === undefined || edited === '' || Number.isNaN(Number(edited)) || saveMutation.isPending}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
