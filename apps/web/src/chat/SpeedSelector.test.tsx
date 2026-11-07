import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeedSelector } from "./SpeedSelector";

test("speed selector presents the request, accessible pressed state and quota warning", () => {
	const html = renderToStaticMarkup(
		<SpeedSelector speed="fast" onSelect={() => {}} disabled={false} />,
	);
	expect(html).toContain('data-testid="speed-option-fast"');
	expect(html).toContain('aria-pressed="true"');
	expect(html).toContain("quota");
	expect(html).toContain("requested");
});
