import { Fragment } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationControlsProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export default function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  if (totalItems === 0) return null

  const pageCount = Math.ceil(totalItems / pageSize)
  const currentPage = Math.min(page, pageCount)
  const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, pageCount - 4))
  const visiblePages = Array.from(
    { length: Math.min(pageCount, 5) },
    (_, index) => firstVisiblePage + index
  )
  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <span aria-live="polite">Showing {firstItem}-{lastItem} of {totalItems}</span>
      </div>

      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Previous page"
          title="Previous page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {visiblePages.map((pageNumber, index) => (
          <Fragment key={pageNumber}>
            {index > 0 && pageNumber - visiblePages[index - 1] > 1 && (
              <span className="px-1 text-sm text-gray-400" aria-hidden="true">...</span>
            )}
            <Button
              type="button"
              size="sm"
              variant={pageNumber === currentPage ? 'default' : 'outline'}
              aria-label={`Page ${pageNumber}`}
              aria-current={pageNumber === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(pageNumber)}
              className="h-8 min-w-8 px-2"
            >
              {pageNumber}
            </Button>
          </Fragment>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Next page"
          title="Next page"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  )
}