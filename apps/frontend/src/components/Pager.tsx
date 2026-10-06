import Link from 'next/link';

export function Pager({ page, totalPages, base }: { page: number; totalPages: number; base: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {page > 1 ? (
        <Link className="rowlink" href={`${base}?page=${page - 1}`}>Previous</Link>
      ) : (
        <span className="text-ink-500">Previous</span>
      )}
      <span className="font-mono text-ink-500">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="rowlink" href={`${base}?page=${page + 1}`}>Next</Link>
      ) : (
        <span className="text-ink-500">Next</span>
      )}
    </div>
  );
}
