import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type MovieDataPlugin from "./main";
import { App, type FlushHandle } from "./ui/App";

export const VIEW_TYPE_MOVIE_DATA = "movie-data-view";

/**
 * Thin Obsidian shell around the React app: owns only the leaf lifecycle
 * (mount on open, unmount on close). All UI state lives in App (design D2).
 */
export class MovieDataView extends ItemView {
	private reactRoot: Root | null = null;
	/** Registered by App; awaited in onClose so a pending note draft persists. */
	private flushHandle: FlushHandle = { current: null };

	constructor(leaf: WorkspaceLeaf, private plugin: MovieDataPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_MOVIE_DATA;
	}

	getDisplayText(): string {
		return "Movie data";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("movie-data-root");
		this.reactRoot = createRoot(container);
		this.reactRoot.render(createElement(App, { store: this.plugin.store, flushHandle: this.flushHandle }));
	}

	async onClose(): Promise<void> {
		// Flush the note autosave before unmounting (spec: closing the view
		// flushes the draft). onClose is async, so Obsidian awaits it.
		try {
			await this.flushHandle.current?.();
		} catch (e) {
			console.error("movie-data: flush on close failed", e);
		}
		this.flushHandle.current = null;
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}
}
