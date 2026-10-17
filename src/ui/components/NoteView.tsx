/**
 * Notes tab: a single plain-text textarea filling the content area (spec:
 * Notes page). Controlled by App's noteDraft (design D3) so the text
 * survives tab switches and view remounts; placeholder shows only while the
 * note is empty; Tab inserts a tab character instead of moving focus.
 */
export function NoteView({
	value,
	onChange,
}: {
	value: string;
	onChange: (next: string) => void;
}) {
	/** Insert a tab at the caret, going through the native setter so React's
	 * value tracker sees the change and onChange fires. */
	const insertTab = (el: HTMLTextAreaElement) => {
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
		if (setter) setter.call(el, value.slice(0, start) + "\t" + value.slice(end));
		el.dispatchEvent(new Event("input", { bubbles: true }));
		// React has flushed by now (discrete input): put the caret after the tab.
		el.setSelectionRange(start + 1, start + 1);
	};

	return (
		<textarea
			className="movie-data-note"
			spellCheck={false}
			placeholder="Start typing..."
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onKeyDown={(e) => {
				if (e.key !== "Tab") return;
				e.preventDefault(); // keep focus in the editor (spec)
				insertTab(e.currentTarget);
			}}
		/>
	);
}
