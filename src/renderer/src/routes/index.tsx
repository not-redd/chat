import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: RouteComponent
});

export function RouteComponent() {
	return <div>{'Hello "/"!'}</div>;
}
