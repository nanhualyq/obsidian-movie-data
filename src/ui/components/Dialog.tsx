import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Native `<dialog>` shell (change: add-detail-and-dialog-flows, design D2/D3).
 *
 * The caller owns openness through React state: unmounting this component is
 * the only close path. On mount the dialog enters the top layer via
 * showModal(); the layout-effect cleanup closes it (layout timing so the
 * element is still connected when close() runs).
 *
 * Dismissal funnels into a single `onDismiss` callback:
 * - Escape fires the native `cancel` event, which is preventDefault()ed and
 *   routed here - the UA never closes the dialog itself, so dismissal always
 *   runs through the caller's pop path (and form pops discard staged covers).
 * - Backdrop clicks land on the dialog element itself (`target === current
 *   target`); the single body wrapper child absorbs every content click.
 *
 * jsdom ships HTMLDialogElement without showModal()/close(), so both calls
 * are feature-detected and fall back to the plain `open` attribute - content
 * stays queryable in tests (design D3).
 */
export function Dialog({
	label,
	onDismiss,
	className,
	children,
}: {
	/** Accessible name for the dialog. */
	label: string;
	onDismiss: () => void;
	className?: string;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	// Always call the latest onDismiss without re-running the open effect.
	const dismissRef = useRef(onDismiss);
	dismissRef.current = onDismiss;

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (typeof el.showModal === "function") el.showModal();
		else el.open = true;
		const onCancel = (e: Event) => {
			e.preventDefault(); // we close via state, never via the UA path
			dismissRef.current();
		};
		el.addEventListener("cancel", onCancel);
		return () => {
			el.removeEventListener("cancel", onCancel);
			if (typeof el.close === "function") el.close();
			else el.open = false;
		};
	}, []);

	return (
		<dialog
			ref={ref}
			className={"movie-data-dialog" + (className ? ` ${className}` : "")}
			aria-label={label}
			onClick={(e) => {
				if (e.target === e.currentTarget) dismissRef.current();
			}}
		>
			<div className="movie-data-dialog-body">{children}</div>
		</dialog>
	);
}
