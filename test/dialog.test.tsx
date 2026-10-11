// Dialog wrapper unit tests (change: add-detail-and-dialog-flows, task 1.1):
// jsdom has no showModal()/close()/cancel dispatch (design D3), so these cover
// the feature-detect fallback, the cancel-event routing, and backdrop clicks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "../src/ui/components/Dialog";

afterEach(cleanup);

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("Dialog wrapper", () => {
	it("renders content queryable in jsdom via the open fallback", () => {
		render(
			<Dialog label="Details" onDismiss={() => {}}>
				<h2>Detail body</h2>
			</Dialog>
		);
		expect(dialog().open).toBe(true); // showModal is missing: el.open = true
		expect(screen.getByText("Detail body")).toBeTruthy();
		expect(dialog().getAttribute("aria-label")).toBe("Details");
	});

	it("routes the native cancel event (Escape) to onDismiss and prevents the default", () => {
		const onDismiss = vi.fn();
		render(
			<Dialog label="Details" onDismiss={onDismiss}>
				<p>body</p>
			</Dialog>
		);
		const evt = new Event("cancel", { cancelable: true });
		fireEvent(dialog(), evt);
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(evt.defaultPrevented).toBe(true); // UA close path suppressed
	});

	it("backdrop clicks (target === dialog) dismiss; content clicks do not", () => {
		const onDismiss = vi.fn();
		render(
			<Dialog label="Details" onDismiss={onDismiss}>
				<p>body content</p>
			</Dialog>
		);
		fireEvent.click(screen.getByText("body content"));
		expect(onDismiss).not.toHaveBeenCalled();
		fireEvent.click(dialog()); // backdrop: the event target is the dialog itself
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("unmount closes the dialog through the cleanup path", () => {
		const { unmount } = render(
			<Dialog label="Details" onDismiss={() => {}}>
				<p>body</p>
			</Dialog>
		);
		const el = dialog();
		expect(el.open).toBe(true);
		unmount();
		expect(el.open).toBe(false); // jsdom fallback: close() missing -> el.open = false
	});

	it("always invokes the latest onDismiss (no stale closure)", () => {
		const first = vi.fn();
		const { rerender } = render(
			<Dialog label="Details" onDismiss={first}>
				<p>body</p>
			</Dialog>
		);
		const second = vi.fn();
		rerender(
			<Dialog label="Details" onDismiss={second}>
				<p>body</p>
			</Dialog>
		);
		fireEvent(dialog(), new Event("cancel", { cancelable: true }));
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});
});
