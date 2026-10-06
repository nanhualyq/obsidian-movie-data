import { useState } from "react";

/**
 * Delete action for the edit forms (D1: inline two-step confirmation -
 * first click arms, second click executes; no blocking modal).
 * Hidden entirely by the parent for unsaved (add-mode) entities.
 *
 * `guardWarning`: when non-null, clicking Delete shows this warning instead
 * of entering the confirmation state (referenced-actor block, D3).
 */
export function DeleteControls({
	onConfirm,
	guardWarning = null,
	disabled = false,
}: {
	onConfirm: () => Promise<boolean>;
	guardWarning?: string | null;
	disabled?: boolean;
}) {
	const [confirming, setConfirming] = useState(false);
	const [warning, setWarning] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const onDeleteClick = () => {
		if (guardWarning !== null) {
			setConfirming(false);
			setWarning(guardWarning);
			return;
		}
		setWarning(null);
		setConfirming(true);
	};

	const onConfirmClick = async () => {
		setBusy(true);
		try {
			const ok = await onConfirm();
			// failure (save error) keeps the form open; return to the armed state
			if (!ok) setConfirming(false);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="movie-data-delete">
			{confirming ? (
				<>
					<button type="button" className="mod-warning" disabled={busy} onClick={onConfirmClick}>
						Confirm delete?
					</button>
					<button type="button" disabled={busy} onClick={() => setConfirming(false)}>
						Cancel
					</button>
				</>
			) : (
				<button type="button" className="mod-warning" disabled={disabled || busy} onClick={onDeleteClick}>
					Delete
				</button>
			)}
			{warning && (
				<div className="movie-data-delete-warning" role="alert">
					{warning}
				</div>
			)}
		</div>
	);
}
