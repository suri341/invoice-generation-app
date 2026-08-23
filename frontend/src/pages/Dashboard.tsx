import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { customersApi, partsApi, invoicesApi } from '@/lib/api'
import { FileText, Users, Package, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function Dashboard() {
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll().then(res => res.data),
  })

  const { data: parts } = useQuery({
    queryKey: ['parts'],
    queryFn: () => partsApi.getAll().then(res => res.data),
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getAll().then(res => res.data),
  })

  const stats = [
    {
      title: 'Total Customers',
      value: customers?.length || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Parts',
      value: parts?.length || 0,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Invoices',
      value: invoices?.length || 0,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(
        invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0
      ),
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  const recentInvoices = invoices?.slice(0, 5) || []

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
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No invoices yet. Create your first invoice!</p>
          ) : (
            <div className="space-y-4">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-500">{invoice.customer.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(invoice.total_amount)}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      COMPLETED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
