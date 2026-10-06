import { useEffect, useState } from "react";
import type { MovieStore } from "../store";

export type CoverState =
	| { status: "empty" } // no filename
	| { status: "loading" }
	| { status: "ok"; url: string }
	| { status: "error" }; // missing/corrupt file

/**
 * Lazily decode a stored cover to an object URL (design D5).
 * Missing/corrupt files resolve to "error" so callers can show the
 * "?" placeholder instead of failing (spec: cover file is corrupt).
 */
export function useCoverUrl(store: MovieStore, filename: string): CoverState {
	const [state, setState] = useState<CoverState>(filename ? { status: "loading" } : { status: "empty" });

	useEffect(() => {
		if (!filename) {
			setState({ status: "empty" });
			return;
		}
		let alive = true;
		setState({ status: "loading" });
		store
			.coverUrl(filename)
			.then((url) => {
				if (!alive) return;
				setState(url ? { status: "ok", url } : { status: "error" });
			})
			.catch(() => {
				if (alive) setState({ status: "error" });
			});
		return () => {
			alive = false;
		};
	}, [store, filename]);

	return state;
}
