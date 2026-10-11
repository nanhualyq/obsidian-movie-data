/**
 * Footer pagination control: previous/next (disabled at the range ends) plus
 * the current page position (spec: paginated list display).
 */
export function PaginationBar({
	page,
	total,
	onChange,
}: {
	page: number;
	total: number;
	onChange: (page: number) => void;
}) {
	return (
		<div className="movie-data-pagination">
			<button type="button" className="movie-data-page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
				Prev
			</button>
			<span className="movie-data-page-label">
				{page} / {total}
			</span>
			<button type="button" className="movie-data-page-btn" disabled={page >= total} onClick={() => onChange(page + 1)}>
				Next
			</button>
		</div>
	);
}
