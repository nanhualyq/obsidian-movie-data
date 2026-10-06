// Minimal stand-in for the Obsidian plugin API, resolved for tests via the
// `obsidian` alias in vitest.config.ts.
//
// Deliberately tiny: no FakeElement (the old createEl-based harness is gone;
// UI tests render React with Testing Library, store tests use the in-memory
// adapter in memory-app.ts). Only runtime values that src/ imports live here -
// Notice (shown on save failure) plus the view/plugin base classes so
// view.ts and main.ts stay importable under the alias.

export class ItemView {
	leaf: any;
	contentEl: HTMLElement;
	constructor(leaf: any) {
		this.leaf = leaf;
		this.contentEl = document.createElement("div");
	}
	getViewType(): string {
		return "";
	}
	getDisplayText(): string {
		return "";
	}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class Notice {
	static last = "";
	constructor(public message: string) {
		Notice.last = message;
	}
}

export class WorkspaceLeaf {}

export class Plugin {
	app: any;
	manifest: any;
	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}
	registerView(): void {}
	addCommand(): void {}
	addRibbonIcon(): any {
		return document.createElement("div");
	}
	registerDomEvent(): void {}
	onload(): Promise<void> {
		return Promise.resolve();
	}
	onunload(): void {}
}
