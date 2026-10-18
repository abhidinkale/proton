import { forwardRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  {
    currentPage,
    totalPages,
    onPageChange,
    className = ''
  },
  ref
) {
  if (totalPages <= 1) return null;

  return (
    <nav ref={ref} aria-label="Pagination" className={`flex items-center justify-between gap-4 text-xs ${className}`}>
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#575D65]">
        <span>Page <strong className="text-[#151719]">{currentPage}</strong> of <strong className="text-[#151719]">{totalPages}</strong></span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-full border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-full border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
});

export default Pagination;
