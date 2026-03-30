// Security utility for validating request origins
export interface RequestOrigin {
	origin: string;
	referrer: string;
}

export function isAllowedOrigin(
	request: RequestOrigin,
	isDev: boolean,
	devServerUrl?: string
): boolean {
	const { origin, referrer } = request;

	// Allowed origins: app:// protocol, dev server URL, or file:// (for local files)
	const allowedOrigins = ["app://", "file://"];
	if (isDev && devServerUrl) {
		allowedOrigins.push(devServerUrl);
	}

	const isAllowed = allowedOrigins.some(
		(allowed) => origin.startsWith(allowed) || referrer.startsWith(allowed)
	);

	// Allow if origin is allowed, or if origin is empty/null (internal request)
	return isAllowed || origin === "" || origin === "null";
}
