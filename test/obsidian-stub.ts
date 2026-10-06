// Minimal stand-in for the Obsidian plugin API, used by test/verify.ts.
// Bundled via esbuild --alias:obsidian=./test/obsidian-stub.ts

export class FakeElement {
	tag: string;
	cls = new Set<string>();
	text = "";
	children: FakeElement[] = [];
	attrs: Record<string, string> = {};
	value = "";
	checked = false;
	files: any = null;
	src = "";
	oninput: any = null;
	onclick: any = null;
	onchange: any = null;
	onerror: any = null;

	constructor(tag = "div") {
		this.tag = tag;
	}

	get textContent(): string {
		return this.text;
	}
	set textContent(v: string) {
		this.text = v;
	}

	empty(): void {
		this.children = [];
		this.text = "";
	}
	addClass(...cls: string[]): void {
		cls.forEach((c) => this.cls.add(c));
	}
	removeClass(...cls: string[]): void {
		cls.forEach((c) => this.cls.delete(c));
	}
	toggleClass(cls: string, force?: boolean): void {
		if (force) this.cls.add(cls);
		else this.cls.delete(cls);
	}
	setText(t: string): void {
		this.text = t;
	}

	private _mk(tag: string, opts: any): FakeElement {
		const e = new FakeElement(tag);
		if (opts) {
			if (typeof opts === "string") e.text = opts;
			else {
				if (opts.cls) String(opts.cls).split(/\s+/).filter(Boolean).forEach((c: string) => e.cls.add(c));
				if (opts.text != null) e.text = String(opts.text);
				if (opts.attr) Object.assign(e.attrs, opts.attr);
			}
		}
		this.children.push(e);
		return e;
	}

	createEl(tag: string, opts?: any): any {
		return this._mk(tag, opts);
	}
	createDiv(opts?: any): any {
		return this._mk("div", opts);
	}
	createSpan(opts?: any): any {
		return this._mk("span", opts);
	}

	find(pred: (e: FakeElement) => boolean): FakeElement | null {
		if (pred(this)) return this;
		for (const c of this.children) {
			const r = c.find(pred);
			if (r) return r;
		}
		return null;
	}
	findAll(pred: (e: FakeElement) => boolean): FakeElement[] {
		const out: FakeElement[] = [];
		const walk = (e: FakeElement) => {
			if (pred(e)) out.push(e);
			e.children.forEach(walk);
		};
		walk(this);
		return out;
	}
}

export class ItemView {
	leaf: any;
	contentEl = new FakeElement("div");
	constructor(leaf: any) {
		this.leaf = leaf;
	}
	getViewType(): string {
		return "";
	}
	getDisplayText(): string {
		return "";
	}
	async onOpen(): Promise<void> {}
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
	commands: any[] = [];
	ribbons: any[] = [];
	views: Record<string, (leaf: any) => any> = {};
	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}
	registerView(type: string, factory: (leaf: any) => any): void {
		this.views[type] = factory;
	}
	addCommand(cmd: any): void {
		this.commands.push(cmd);
	}
	addRibbonIcon(icon: string, title: string, cb: () => void): any {
		this.ribbons.push({ icon, title, cb });
		return new FakeElement("div");
	}
	registerStylesheet(): void {}
	onload(): Promise<void> {
		return Promise.resolve();
	}
	onunload(): void {}
}
