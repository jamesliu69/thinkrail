import { RiFolderLine as Folder, RiFolderOpenLine as FolderOpen } from "@remixicon/react";
import { useT } from "@thinkrail/locales/react";
import { Button } from "@thinkrail/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@thinkrail/ui/dialog";

export function LocatedFoldersDialog({
	open,
	folderName,
	matches,
	onSelect,
	onEnterPath,
	onOpenChange,
}: {
	open: boolean;
	folderName: string;
	matches: readonly string[];
	onSelect: (path: string) => void;
	onEnterPath: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useT();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[36rem]" data-testid="located-folders-dialog">
				<DialogHeader>
					<div className="flex items-center gap-8">
						<FolderOpen className="size-16 shrink-0 text-primary" />
						<DialogTitle>{t("panels.locatedFolders.title")}</DialogTitle>
					</div>
					<DialogDescription>
						{t("panels.locatedFolders.description", { count: matches.length, name: folderName })}
					</DialogDescription>
				</DialogHeader>

				<div
					className="flex max-h-[min(50vh,24rem)] flex-col gap-4 overflow-y-auto pr-4"
					data-testid="located-folders-list"
				>
					{matches.map((path) => (
						<button
							key={path}
							type="button"
							data-testid="located-folder-option"
							onClick={() => onSelect(path)}
							className="flex w-full items-start gap-12 rounded-sm border border-border-default bg-control-bg p-12 text-left outline-none transition-colors hover:bg-control-bg-hovered focus-visible:ring-2 focus-visible:ring-primary"
						>
							<span className="mt-2 flex size-28 shrink-0 items-center justify-center rounded-sm bg-container-elevated-bg text-text-muted">
								<Folder className="size-16" />
							</span>
							<span className="flex min-w-0 flex-1 flex-col gap-2">
								<span className="truncate text-text-default tr-text-ui">{folderName}</span>
								<span className="truncate text-text-subtle tr-text-metadata">{path}</span>
							</span>
						</button>
					))}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onEnterPath}>
						{t("panels.locatedFolders.enterPath")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
