// TagInput: chip entry, suggestion dropdown, keyboard-first flow, paste
// (change: tag-input-with-history, specs/movie-data-ui).
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "../src/ui/components/TagInput";
import { tagHistory } from "../src/ui/state";
import type { Movie } from "../src/types";

const movie = (id: string, tags: string[]): Movie => ({
	id,
	title: id,
	cover: "",
	tags,
	actorIds: [],
	info: "",
	url: "",
});

/** Controlled harness: exposes the current chips as a testable readout. */
function Harness({ movies, initial = [] }: { movies: Movie[]; initial?: string[] }) {
	const [tags, setTags] = useState<string[]>(initial);
	return (
		<div>
			<TagInput value={tags} onChange={setTags} history={tagHistory(movies)} />
			<output data-testid="chips">{tags.join("|")}</output>
		</div>
	);
}

const chips = () => screen.getByTestId("chips").textContent!.split("|").filter(Boolean);
const input = () => screen.getByLabelText("Tags") as HTMLInputElement;
const suggestions = () =>
	Array.from(document.querySelectorAll(".movie-data-tag-suggestion")).map((li) => li.textContent);
const highlighted = () =>
	document.querySelector(".movie-data-tag-suggestion.is-active")?.textContent ?? null;

beforeEach(() => cleanup());

describe("TagInput: chips (spec: chip-based tag entry)", () => {
	it("adds a tag on Enter, clears the input, no separator involved", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[]} />);
		await user.click(input());
		await user.keyboard("crime{Enter}");
		expect(chips()).toEqual(["crime"]);
		expect(input().value).toBe("");
	});

	it("removes a chip via its remove button and via Backspace on empty input", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[]} initial={["a", "b"]} />);
		await user.click(screen.getByLabelText("Remove tag b"));
		expect(chips()).toEqual(["a"]);
		await user.click(input());
		await user.keyboard("{Backspace}");
		expect(chips()).toEqual([]);
		// further Backspace on empty input with no chips is a no-op, not a crash
		await user.keyboard("{Backspace}");
		expect(chips()).toEqual([]);
	});

	it("dedupes case-insensitively: existing chip casing wins", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[]} initial={["Drama"]} />);
		await user.click(input());
		await user.keyboard("drama{Enter}");
		expect(chips()).toEqual(["Drama"]);
	});

	it("trims whitespace on entry", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[]} />);
		await user.click(input());
		await user.keyboard("  comedy  {Enter}");
		expect(chips()).toEqual(["comedy"]);
	});
});

describe("TagInput: suggestion dropdown (spec: suggestion dropdown from tag history)", () => {
	// drama x3, action x2, comedy x1, thriller x1 -> frequency order, alpha ties
	const MOVIES = [
		movie("m1", ["drama", "action"]),
		movie("m2", ["drama", "action", "comedy"]),
		movie("m3", ["drama", "thriller"]),
	];

	it("opens on focus with top entries in frequency order, first pre-highlighted", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		expect(suggestions()).toEqual(["drama", "action", "comedy", "thriller"]);
		expect(highlighted()).toBe("drama");
	});

	it("caps the unfiltered list at 10 entries", async () => {
		const user = userEvent.setup();
		const many = [movie("m1", Array.from({ length: 15 }, (_, i) => `tag${String(i).padStart(2, "0")}`))];
		render(<Harness movies={many} />);
		await user.click(input());
		expect(suggestions()).toHaveLength(10);
	});

	it("zero-typing path: focus + Enter adds the most-used tag", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		await user.keyboard("{Enter}");
		expect(chips()).toEqual(["drama"]);
	});

	it("filters by case-insensitive substring, preserving frequency order", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		await user.keyboard("R"); // case-insensitive: drama (3), thriller (1)
		expect(suggestions()).toEqual(["drama", "thriller"]);
		await user.keyboard("{Backspace}");
		await user.keyboard("act");
		expect(suggestions()).toEqual(["action"]);
		await user.keyboard("{Backspace}{Backspace}{Backspace}");
		expect(suggestions()).toEqual(["drama", "action", "comedy", "thriller"]); // back to top-4 unfiltered
	});

	it("clicking a suggestion adds it with its stored casing", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[movie("m1", ["Sci-Fi"])]} />);
		await user.click(input());
		await user.click(screen.getByText("Sci-Fi"));
		expect(chips()).toEqual(["Sci-Fi"]);
	});

	it("cold start: placeholder instead of an empty box", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[]} />);
		await user.click(input());
		expect(
			document.querySelector(".movie-data-tag-suggestion.is-placeholder")?.textContent
		).toContain("No tags yet");
	});

	it("dropdown structure: anchored inside the field, listbox under the input", async () => {
		// jsdom does no layout, so verify the positioning contract structurally:
		// the suggestions element lives inside .movie-data-field (its absolute
		// anchor) and after the input wrapper in DOM order.
		const user = userEvent.setup();
		const { container } = render(<Harness movies={[movie("m1", ["solo"])]} />);
		const field = container.querySelector(".movie-data-field")!;
		expect(field.classList.contains("movie-data-tag-field")).toBe(true);
		await user.click(input());
		const list = container.querySelector(".movie-data-tag-suggestions")!;
		expect(list.getAttribute("role")).toBe("listbox");
		expect(field.contains(list)).toBe(true); // positioned relative to the field
		expect(field.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

describe("TagInput: keyboard-first (spec: keyboard-first tag entry)", () => {
	const MOVIES = [movie("m1", ["alpha", "beta", "gamma"])];

	it("arrows wrap the highlight without changing the input text", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		await user.keyboard("a"); // filter: alpha, beta, gamma (all contain 'a'), idx = 0
		expect(highlighted()).toBe("alpha");
		await user.keyboard("{ArrowDown}");
		expect(highlighted()).toBe("beta");
		await user.keyboard("{ArrowDown}");
		expect(highlighted()).toBe("gamma");
		await user.keyboard("{ArrowDown}"); // wrap: last -> first
		expect(highlighted()).toBe("alpha");
		await user.keyboard("{ArrowUp}"); // wrap up: first -> last
		expect(highlighted()).toBe("gamma");
		expect(input().value).toBe("a"); // text untouched by arrows
	});

	it("Enter commits the highlighted suggestion", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		await user.keyboard("{ArrowDown}{Enter}"); // 0 -> 1 = beta
		expect(chips()).toEqual(["beta"]);
	});

	it("Enter commits typed text when nothing matches", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		await user.keyboard("zzz{Enter}");
		expect(chips()).toEqual(["zzz"]);
	});

	it("Enter with empty input and nothing highlighted is a safe no-op", async () => {
		const user = userEvent.setup();
		render(<Harness movies={[]} initial={[]} />);
		await user.click(input());
		await user.keyboard("{Escape}{Enter}"); // closed first: no highlight, empty text
		expect(chips()).toEqual([]);
	});

	it("Escape closes the dropdown but keeps the typed text", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} />);
		await user.click(input());
		await user.keyboard("drama-ish");
		expect(document.querySelector(".movie-data-tag-suggestions")).not.toBeNull();
		await user.keyboard("{Escape}");
		expect(document.querySelector(".movie-data-tag-suggestions")).toBeNull();
		expect(input().value).toBe("drama-ish");
	});

	it("Tab is unbound: no tag added, default not prevented", async () => {
		render(<Harness movies={MOVIES} />);
		const el = input();
		el.focus();
		fireEvent.keyDown(el, { key: "Tab" });
		expect(chips()).toEqual([]); // nothing committed
		expect(el.value).toBe(""); // no completion
	});

	it("blur closes the dropdown, keeping typed text and chips", async () => {
		const user = userEvent.setup();
		render(<Harness movies={MOVIES} initial={["keep"]} />);
		await user.click(input());
		await user.keyboard("half");
		await user.click(document.body);
		expect(document.querySelector(".movie-data-tag-suggestions")).toBeNull();
		expect(chips()).toEqual(["keep"]);
		expect(input().value).toBe("half");
	});
});

describe("TagInput: paste (spec: tag normalization on entry)", () => {
	it("splits pasted text on half- and full-width commas into three chips", () => {
		render(<Harness movies={[]} />);
		fireEvent.paste(input(), {
			clipboardData: { getData: () => "action, drama，thriller" },
		});
		expect(chips()).toEqual(["action", "drama", "thriller"]);
	});

	it("paste without a comma keeps default behavior (no chips added)", () => {
		render(<Harness movies={[]} />);
		fireEvent.paste(input(), { clipboardData: { getData: () => "just words" } });
		expect(chips()).toEqual([]);
	});

	it("pasted pieces are trimmed and deduped case-insensitively", () => {
		render(<Harness movies={[]} initial={["Drama"]} />);
		fireEvent.paste(input(), { clipboardData: { getData: () => "drama,  comedy ," } });
		expect(chips()).toEqual(["Drama", "comedy"]);
	});
});
