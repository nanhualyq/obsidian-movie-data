import { Plugin, WorkspaceLeaf } from "obsidian";
import { MovieStore } from "./store";
import { MovieDataView, VIEW_TYPE_MOVIE_DATA } from "./view";

export default class MovieDataPlugin extends Plugin {
	store!: MovieStore;

	async onload(): Promise<void> {
		this.store = new MovieStore(this.app);
		await this.store.ensure();
		// Load happens in the React App on mount (design D3): the store no
		// longer keeps data, and a cached result would go stale across
		// view close/reopen cycles.

		this.registerView(VIEW_TYPE_MOVIE_DATA, (leaf: WorkspaceLeaf) => new MovieDataView(leaf, this));

		this.addCommand({
			id: "open-movie-data",
			name: "Open movie data",
			callback: () => this.openView(),
		});

		this.addRibbonIcon("film", "Open movie data", () => this.openView());
	}

	/** Open the movie data tab, or focus it if already open (reuse). */
	async openView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MOVIE_DATA);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_MOVIE_DATA, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	onunload(): void {
		this.store?.unload();
	}
}
