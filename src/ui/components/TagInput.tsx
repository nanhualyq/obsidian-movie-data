import { useMemo, useState } from "react";
import type { TagCount } from "../state";

/** Suggestions shown when unfiltered (design D2: the stable top of the list). */
const MAX_SUGGESTIONS = 10;

/**
 * Chip-based tag input (change: tag-input-with-history).
 *
 * - Chips instead of typed separators; controlled via `value`/`onChange`.
 * - Focus opens a suggestion dropdown from the shared tag history: top 10 by
 *   frequency, first entry pre-highlighted (zero-typing path = focus + Enter).
 * - Typing filters by case-insensitive substring, frequency order preserved.
 * - Keyboard-first: arrows wrap the highlight, Enter commits suggestion or
 *   typed text, Escape closes keeping text, Backspace on empty input removes
 *   the last chip, Tab unbound, blur closes keeping state (design D3).
 * - Adds are trimmed and deduplicated case-insensitively (existing chip wins,
 *   design D4); pasted text splits on half/full-width commas only.
 */
export function TagInput({
	value,
	onChange,
	history,
}: {
	value: string[];
	onChange: (next: string[]) => void;
	history: TagCount[];
}) {
	const [inputText, setInputText] = useState("");
	const [open, setOpen] = useState(false);
	const [activeIdx, setActiveIdx] = useState(-1);

	const query = inputText.trim().toLowerCase();
	// Cap applies unfiltered only (design D5): typing is the path to tags
	// outside the top 10, so filtering runs over the full history.
	const matches = useMemo(
		() => (query ? history.filter((e) => e.tag.toLowerCase().includes(query)) : history.slice(0, MAX_SUGGESTIONS)),
		[history, query]
	);

	/** Case-insensitive idempotent add: the existing chip's casing wins. */
	const addTag = (raw: string) => {
		const tag = raw.trim();
		if (!tag) return;
		if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
		onChange([...value, tag]);
	};

	const removeLast = () => onChange(value.slice(0, -1));

	/** Commit the highlighted suggestion, else the typed text; then reset. */
	const commit = () => {
		const picked = open && activeIdx >= 0 ? matches[activeIdx]?.tag : undefined;
		addTag(picked ?? inputText);
		setInputText("");
		setOpen(false);
		setActiveIdx(-1);
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			// Bound only while open (design D3 risk: no form exists here, but
			// Enter must not leak to other handlers mid-selection).
			if (open) e.preventDefault();
			commit();
			return;
		}
		if (e.key === "Escape") {
			if (!open) return;
			e.preventDefault();
			setOpen(false);
			setActiveIdx(-1);
			return;
		}
		if (e.key === "Backspace") {
			if (inputText === "" && value.length > 0) {
				e.preventDefault();
				removeLast();
			}
			return;
		}
		// Arrows only while open with something to highlight; Tab stays unbound.
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
		if (!open || matches.length === 0) return;
		e.preventDefault();
		setActiveIdx((i) =>
			e.key === "ArrowDown" ? (i + 1) % matches.length : i <= 0 ? matches.length - 1 : i - 1
		);
	};

	const onTextChange = (next: string) => {
		setInputText(next);
		setOpen(true);
		// Refilter on every keystroke: pre-highlight best match (design D2).
		const q = next.trim().toLowerCase();
		const pool = q ? history.filter((e) => e.tag.toLowerCase().includes(q)) : history.slice(0, MAX_SUGGESTIONS);
		setActiveIdx(pool.length > 0 ? 0 : -1);
	};

	const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		const text = e.clipboardData.getData("text");
		// Comma (half/full-width) is meaningful on paste only (design D4).
		if (!text.includes(",") && !text.includes("，")) return;
		e.preventDefault();
		// Accumulate locally: addTag reads the `value` prop, which is stale
		// within one batched event, so per-piece onChange calls would overwrite.
		const next = [...value];
		for (const piece of text.split(/[,，]/)) {
			const tag = piece.trim();
			if (!tag) continue;
			if (next.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
			next.push(tag);
		}
		if (next.length !== value.length) onChange(next);
	};

	const showPlaceholder = history.length === 0;

	return (
		<div className="movie-data-field movie-data-tag-field">
			<label htmlFor="movie-data-tags-input">Tags</label>
			<div className="movie-data-tag-input">
				{value.map((tag) => (
					<span key={tag} className="movie-data-tag-chip">
						{tag}
						<button
							type="button"
							className="movie-data-tag-chip-remove"
							aria-label={`Remove tag ${tag}`}
							onClick={() => onChange(value.filter((t) => t !== tag))}
						>
							x
						</button>
					</span>
				))}
				<input
					id="movie-data-tags-input"
					type="text"
					value={inputText}
					placeholder="Add tag..."
					autoComplete="off"
					aria-label="Tags"
					aria-expanded={open}
					aria-autocomplete="list"
					onChange={(e) => onTextChange(e.target.value)}
					onKeyDown={onKeyDown}
					onFocus={() => {
						setOpen(true);
						setActiveIdx(matches.length > 0 ? 0 : -1);
					}}
					onBlur={() => {
						setOpen(false);
						setActiveIdx(-1);
					}}
					onPaste={onPaste}
				/>
			</div>
			{open && (
				<ul className="movie-data-tag-suggestions" role="listbox" aria-label="Tag suggestions">
					{showPlaceholder && (
						<li className="movie-data-tag-suggestion is-placeholder">No tags yet - type to create the first</li>
					)}
					{!showPlaceholder &&
						matches.map((m, i) => (
							<li
								key={m.tag}
								role="option"
								aria-selected={i === activeIdx}
								className={"movie-data-tag-suggestion" + (i === activeIdx ? " is-active" : "")}
								// Keep focus in the input so blur doesn't close the
								// dropdown before this click registers.
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									addTag(m.tag);
									setInputText("");
									setOpen(false);
									setActiveIdx(-1);
								}}
							>
								{m.tag}
							</li>
						))}
				</ul>
			)}
		</div>
	);
}
