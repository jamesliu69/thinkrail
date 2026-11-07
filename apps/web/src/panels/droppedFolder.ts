export interface DroppedItemSummary {
	name: string;
	isDirectory: boolean;
}

export interface DroppedItemsSummary {
	itemCount: number;
	entries: DroppedItemSummary[] | null;
}

export function droppedFolderName(summary: DroppedItemsSummary): string | null {
	if (summary.itemCount !== 1 || summary.entries === null) return null;
	if (summary.entries.length !== 1) return null;
	const [entry] = summary.entries;
	if (!entry?.isDirectory) return null;
	const name = entry.name;
	return name === "" ? null : name;
}
