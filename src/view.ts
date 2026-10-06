import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type MovieDataPlugin from "./main";
import { App } from "./ui/App";

export const VIEW_TYPE_MOVIE_DATA = "movie-data-view";

/**
 * Thin Obsidian shell around the React app: owns only the leaf lifecycle
 * (mount on open, unmount on close). All UI state lives in App (design D2).
 */
export class MovieDataView extends ItemView {
	private reactRoot: Root | null = null;

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
		this.reactRoot.render(createElement(App, { store: this.plugin.store }));
	}

	async onClose(): Promise<void> {
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}
}
