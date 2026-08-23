export interface Customer {
  id: number
  name: string
  company_name?: string
  email?: string
  phone: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  created_at: string
  updated_at?: string
}

export interface Part {
  id: number
  name: string
  category: string
  description?: string
  unit: string
  hsn_code?: string
  price: number
  image_url?: string
  created_at: string
  updated_at?: string
}

export interface InvoiceItem {
  id?: number
  part_id?: number
  part_name: string
  description?: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
}

export type InvoiceType = 'invoice' | 'quotation'
export type InvoiceStatus = 'completed'

export interface Invoice {
  id: number
  invoice_number: string
  invoice_type: InvoiceType
  status: InvoiceStatus
  customer_id: number
  customer: {
    id: number
    name: string
    company_name?: string
    phone: string
  }
  invoice_date: string
  due_date?: string
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  discount_percentage: number
  discount_amount: number
  total_amount: number
  notes?: string
  terms_conditions?: string
  items: InvoiceItem[]
  created_at: string
  updated_at?: string
}

export interface CreateInvoiceData {
  customer_id: number
  invoice_type: InvoiceType
  invoice_date?: string
  due_date?: string
  discount_percentage?: number
  notes?: string
  terms_conditions?: string
  items: Omit<InvoiceItem, 'id' | 'amount'>[]
}
