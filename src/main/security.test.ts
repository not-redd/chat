import { describe, it, expect } from "vite-plus/test";

import { isAllowedOrigin } from "./security";

// Tests for the actual production security validation function
describe("Protocol Origin Security", () => {
	describe("isAllowedOrigin production function", () => {
		it("should allow requests from app:// origin", () => {
			expect(isAllowedOrigin({ origin: "app://", referrer: "" }, false)).toBe(true);
			expect(isAllowedOrigin({ origin: "app://index.html", referrer: "" }, false)).toBe(true);
		});

		it("should allow requests from file:// origin", () => {
			expect(isAllowedOrigin({ origin: "file://", referrer: "" }, false)).toBe(true);
			expect(isAllowedOrigin({ origin: "file:///path/to/file", referrer: "" }, false)).toBe(
				true
			);
		});

		it("should allow requests with null or empty origin", () => {
			expect(isAllowedOrigin({ origin: "", referrer: "" }, false)).toBe(true);
			expect(isAllowedOrigin({ origin: "null", referrer: "" }, false)).toBe(true);
		});

		it("should allow requests from dev server in development mode", () => {
			expect(
				isAllowedOrigin(
					{ origin: "http://localhost:3000", referrer: "" },
					true,
					"http://localhost:3000"
				)
			).toBe(true);
			expect(
				isAllowedOrigin(
					{ origin: "http://localhost:5173", referrer: "" },
					true,
					"http://localhost:5173"
				)
			).toBe(true);
		});

		it("should block requests from external https:// origins", () => {
			expect(isAllowedOrigin({ origin: "https://evil.com", referrer: "" }, false)).toBe(
				false
			);
			expect(isAllowedOrigin({ origin: "https://attacker.com", referrer: "" }, false)).toBe(
				false
			);
		});

		it("should block requests from external http:// origins", () => {
			expect(
				isAllowedOrigin({ origin: "http://malicious-site.com", referrer: "" }, false)
			).toBe(false);
			expect(isAllowedOrigin({ origin: "http://localhost:3000", referrer: "" }, false)).toBe(
				false
			); // Only allowed in dev
		});

		it("should block requests from non-app/file protocols", () => {
			const blockedOrigins = [
				"https://example.com",
				"https://google.com",
				"chrome-extension://abc123",
				"https://attacker.com"
			];

			for (const origin of blockedOrigins) {
				expect(isAllowedOrigin({ origin, referrer: "" }, false)).toBe(false);
			}
		});

		it("should block requests from dev server in production mode", () => {
			expect(
				isAllowedOrigin(
					{ origin: "http://localhost:3000", referrer: "" },
					false,
					"http://localhost:3000"
				)
			).toBe(false);
		});
	});
});
