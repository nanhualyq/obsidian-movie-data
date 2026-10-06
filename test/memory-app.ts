// Shared in-memory vault adapter for headless tests. Mimics the Obsidian
// adapter surface the store uses (exists/mkdir/read/write/readBinary/writeBinary)
// and records write order so tests can assert covers-before-JSON persistence.

export interface MemoryApp {
	app: any;
	files: Map<string, string | Buffer>;
	/** Path of every write, in order (binary + text). */
	writes: string[];
}

export function createMemoryApp(): MemoryApp {
	const files = new Map<string, string | Buffer>();
	const writes: string[] = [];
	const adapter = {
		exists: async (p: string) => files.has(p),
		mkdir: async (p: string) => void files.set(p, null as any),
		read: async (p: string) => {
			const v = files.get(p);
			if (v === undefined || v === null) throw new Error("ENOENT " + p);
			return v;
		},
		write: async (p: string, c: string) => {
			writes.push(p);
			files.set(p, c);
		},
		writeBinary: async (p: string, b: ArrayBuffer) => {
			writes.push(p);
			files.set(p, Buffer.from(b));
		},
		readBinary: async (p: string) => {
			const v = files.get(p);
			if (v === undefined || v === null) throw new Error("ENOENT " + p);
			return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
		},
	};
	return { app: { vault: { adapter } }, files, writes };
}
