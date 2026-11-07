import { useT } from "@thinkrail/locales/react";
import { useEffect, useRef, useState } from "react";
import { hasLayer, MODAL_LAYER_SELECTOR } from "../lib";
import { type DroppedItemsSummary, droppedFolderName } from "../panels/droppedFolder";
import { LocatedFoldersDialog } from "../panels/LocatedFoldersDialog";
import { useOpenProject } from "../panels/useOpenProject";
import { goToProjectHome } from "../panels/workspaceActions";
import { selectSupportsProjectLocateFolder, useAppStore } from "../store";
import { getTransport } from "../transport";

const LOCATE_TIMEOUT_MS = 10_000;

function dragHasFiles(event: DragEvent): boolean {
	return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function summarizeDrop(dataTransfer: DataTransfer): DroppedItemsSummary {
	const items = dataTransfer.items;
	if (items.length === 0) return { itemCount: 0, entries: null };
	const entries: { name: string; isDirectory: boolean }[] = [];
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item?.kind !== "file") continue;
		const entry = item.webkitGetAsEntry();
		if (entry) entries.push({ name: entry.name, isDirectory: entry.isDirectory });
	}
	return { itemCount: items.length, entries };
}

export function DroppedFolderHost() {
	const t = useT();
	const supportsLocate = useAppStore(selectSupportsProjectLocateFolder);
	const [dragActive, setDragActive] = useState(false);
	const [chooser, setChooser] = useState<{ folderName: string; matches: string[] } | null>(null);
	const { openProject, enterHostPath, dialogs } = useOpenProject((project) => {
		goToProjectHome(project.id);
	});
	const dragDepthRef = useRef(0);
	const dropSeqRef = useRef(0);

	const handleFolderDrop = async (name: string) => {
		dropSeqRef.current += 1;
		const seq = dropSeqRef.current;
		setChooser(null);
		if (!supportsLocate) {
			enterHostPath({
				prefilledPath: name,
				reason: t("panels.locatedFolders.locateFailed", { name }),
			});
			return;
		}
		try {
			const { matches } = await getTransport().request(
				"project.locateFolder",
				{ name },
				{ timeoutMs: LOCATE_TIMEOUT_MS },
			);
			if (seq !== dropSeqRef.current) return;
			if (matches.length === 0) {
				enterHostPath({
					prefilledPath: name,
					reason: t("panels.openProjectPath.locateMissed", { name }),
				});
				return;
			}
			if (matches.length === 1) {
				const [match] = matches;
				if (match) await openProject(match);
				return;
			}
			setChooser({ folderName: name, matches });
		} catch {
			if (seq !== dropSeqRef.current) return;
			enterHostPath({
				prefilledPath: name,
				reason: t("panels.locatedFolders.locateFailed", { name }),
			});
		}
	};

	const handleDropRef = useRef(handleFolderDrop);
	useEffect(() => {
		handleDropRef.current = handleFolderDrop;
	});

	useEffect(() => {
		const resetDrag = () => {
			dragDepthRef.current = 0;
			setDragActive(false);
		};

		const onDragEnter = (event: DragEvent) => {
			if (event.defaultPrevented || !dragHasFiles(event)) return;
			if (hasLayer(document, MODAL_LAYER_SELECTOR)) return;
			dragDepthRef.current += 1;
			setDragActive(true);
		};

		const onDragOver = (event: DragEvent) => {
			if (event.defaultPrevented || !dragHasFiles(event)) return;
			if (hasLayer(document, MODAL_LAYER_SELECTOR)) return;
			event.preventDefault();
		};

		const onDragLeave = (event: DragEvent) => {
			if (!dragHasFiles(event)) return;
			dragDepthRef.current -= 1;
			if (dragDepthRef.current <= 0) resetDrag();
		};

		const onDrop = (event: DragEvent) => {
			if (!dragHasFiles(event)) return;
			resetDrag();
			if (event.defaultPrevented) return;
			event.preventDefault();
			if (hasLayer(document, MODAL_LAYER_SELECTOR)) return;
			if (!event.dataTransfer) return;
			const name = droppedFolderName(summarizeDrop(event.dataTransfer));
			if (!name) return;
			void handleDropRef.current(name);
		};

		const onBlur = () => resetDrag();
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") resetDrag();
		};

		window.addEventListener("dragenter", onDragEnter);
		window.addEventListener("dragover", onDragOver);
		window.addEventListener("dragleave", onDragLeave);
		window.addEventListener("drop", onDrop);
		window.addEventListener("blur", onBlur);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.removeEventListener("dragenter", onDragEnter);
			window.removeEventListener("dragover", onDragOver);
			window.removeEventListener("dragleave", onDragLeave);
			window.removeEventListener("drop", onDrop);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	return (
		<>
			{dragActive ? (
				<div
					role="status"
					data-testid="dropped-folder-overlay"
					className="pointer-events-none fixed inset-0 z-200 flex items-center justify-center bg-overlay"
				>
					<div className="rounded-lg border border-border-default bg-container-elevated-bg px-24 py-16 text-text-default tr-heading-lg shadow-(--shadow-lg)">
						{t("shell.droppedFolder.hint")}
					</div>
				</div>
			) : null}
			<LocatedFoldersDialog
				open={chooser !== null}
				folderName={chooser?.folderName ?? ""}
				matches={chooser?.matches ?? []}
				onSelect={(path) => {
					setChooser(null);
					void openProject(path);
				}}
				onEnterPath={() => {
					const current = chooser;
					setChooser(null);
					if (current) enterHostPath({ prefilledPath: current.folderName });
				}}
				onOpenChange={(open) => {
					if (!open) setChooser(null);
				}}
			/>
			{dialogs}
		</>
	);
}
