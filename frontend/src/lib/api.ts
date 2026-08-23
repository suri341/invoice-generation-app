import axios from 'axios'
import type { Customer, Part, Invoice, CreateInvoiceData } from '@/types'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const customersApi = {
  getAll: (params?: { search?: string; skip?: number; limit?: number }) =>
    api.get<Customer[]>('/api/customers/', { params }),

  getById: (id: number) =>
    api.get<Customer>(`/api/customers/${id}`),

  create: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Customer>('/api/customers/', data),

  update: (id: number, data: Partial<Customer>) =>
    api.put<Customer>(`/api/customers/${id}`, data),

  delete: (id: number) =>
    api.delete(`/api/customers/${id}`),
}

export const partsApi = {
  getAll: (params?: { category?: string; search?: string; skip?: number; limit?: number }) =>
    api.get<Part[]>('/api/parts/', { params }),

  getById: (id: number) =>
    api.get<Part>(`/api/parts/${id}`),

  getCategories: () =>
    api.get<string[]>('/api/parts/categories'),

  create: (data: Omit<Part, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Part>('/api/parts/', data),

  update: (id: number, data: Partial<Part>) =>
    api.put<Part>(`/api/parts/${id}`, data),

  delete: (id: number) =>
    api.delete(`/api/parts/${id}`),
}

export const invoicesApi = {
  getAll: (params?: { status?: string; customer_id?: number; search?: string; skip?: number; limit?: number }) =>
    api.get<Invoice[]>('/api/invoices/', { params }),

  getById: (id: number) =>
    api.get<Invoice>(`/api/invoices/${id}`),

  create: (data: CreateInvoiceData) =>
    api.post<Invoice>('/api/invoices/', data),

  update: (id: number, data: Partial<CreateInvoiceData>) =>
    api.put<Invoice>(`/api/invoices/${id}`, data),

  delete: (id: number) =>
    api.delete(`/api/invoices/${id}`),

  downloadPdf: (id: number) =>
    api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' }),

  updateStatus: (id: number, status: string) =>
    api.post(`/api/invoices/${id}/status`, null, { params: { new_status: status } }),
}
