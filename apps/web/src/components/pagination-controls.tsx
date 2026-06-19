import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@StayBook/ui/components/pagination";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  pageSize,
  total,
  pageCount,
  onPageChange,
}: PaginationControlsProps) {
  if (total === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const isFirstPage = page <= 1;
  const isLastPage = page >= pageCount;

  return (
    <section className="flex flex-wrap items-center justify-center gap-3 sm:justify-between">
      <p className="whitespace-nowrap text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground tabular-nums">{start}</span>
        –
        <span className="font-medium text-foreground tabular-nums">{end}</span>{" "}
        of{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>
      <PaginationRoot>
        <PaginationContent className="items-center gap-2">
          <PaginationItem>
            <PaginationPrevious
              disabled={isFirstPage}
              onClick={() => {
                if (!isFirstPage) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          <span className="whitespace-nowrap text-sm tabular-nums px-1">
            Page {page} of {Math.max(pageCount, 1)}
          </span>
          <PaginationItem>
            <PaginationNext
              disabled={isLastPage}
              onClick={() => {
                if (!isLastPage) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationRoot>
    </section>
  );
}
