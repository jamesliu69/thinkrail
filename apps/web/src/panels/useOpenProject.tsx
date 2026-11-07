import type { Project } from "@thinkrail/contracts";
import { T, useT } from "@thinkrail/locales/react";
import { type ReactNode, useState } from "react";
import { selectSupportsProjectClone, useAppStore } from "../store";
import { errorText, getTransport } from "../transport";
import { CloneProjectDialog } from "./CloneProjectDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { createLatestOperation } from "./latestOperation";
import { NoticeDialog } from "./NoticeDialog";
import { OpenProjectPathDialog } from "./OpenProjectPathDialog";
import { explainOpenFailure } from "./openProjectFailure";

const PICK_TIMEOUT_MS = 30 * 60_000;
const projectOpenIntents = createLatestOperation();

export type OpenedProjectIntent = { setup: boolean };

export interface EnterHostPathHint {
	prefilledPath?: string;
	reason?: string | null;
}

export type ProjectOpenIntent = () => boolean;

export function useOpenProject(
	onOpened: (project: Project, intent: OpenedProjectIntent) => void | Promise<void>,
): {
	beginOpenProjectIntent: () => ProjectOpenIntent;
	openProject: (rawPath: string, intent?: ProjectOpenIntent) => Promise<void>;
	pickAndOpen: () => Promise<void>;
	enterHostPath: (hint?: EnterHostPathHint, intent?: ProjectOpenIntent) => void;
	startNewProject: () => void;
	cloneRepository: (() => void) | undefined;
	dialogs: ReactNode;
} {
	const t = useT();
	const supportsClone = useAppStore(selectSupportsProjectClone);
	const [cloneIntent, setCloneIntent] = useState<{ isCurrent: () => boolean } | null>(null);
	const [initTarget, setInitTarget] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [openError, setOpenError] = useState<string | null>(null);
	const [pathEntry, setPathEntry] = useState<{
		reason: string | null;
		prefilledPath?: string;
	} | null>(null);

	const adopt = async (
		project: Project,
		isCurrent: () => boolean,
		intent: OpenedProjectIntent = { setup: false },
	) => {
		if (!isCurrent()) return;
		useAppStore.getState().applyProjectUpdated(project);
		if (!isCurrent()) return;
		await onOpened(project, intent);
	};

	const openProjectForIntent = async (rawPath: string, isCurrent: () => boolean) => {
		if (rawPath === "" || !isCurrent()) return;
		try {
			const project = await getTransport().request("project.open", { path: rawPath });
			if (!isCurrent()) return;
			await adopt(project, isCurrent);
			if (!isCurrent()) return;
		} catch (err) {
			if (!isCurrent()) return;
			const failure = await explainOpenFailure(err, rawPath, t);
			if (!isCurrent()) return;
			if (failure.kind === "initable") setInitTarget(rawPath);
			else setOpenError(failure.text);
		}
	};

	const beginOpenProjectIntent = () => projectOpenIntents.begin();

	const openProject = (rawPath: string, intent?: ProjectOpenIntent) =>
		openProjectForIntent(rawPath, intent ?? projectOpenIntents.begin());

	const initProject = async (path: string) => {
		const isCurrent = projectOpenIntents.begin();
		try {
			const project = await getTransport().request("project.init", { path });
			if (!isCurrent()) return;
			await adopt(project, isCurrent);
			if (!isCurrent()) return;
		} catch (err) {
			if (!isCurrent()) return;
			setOpenError(errorText(err, t("panels.openProject.initFailed", { path })));
		}
	};

	const startNewProject = () => {
		projectOpenIntents.begin();
		setCreating(true);
	};

	const cloneRepository = supportsClone
		? () => {
				setCloneIntent({ isCurrent: projectOpenIntents.begin() });
			}
		: undefined;

	const enterHostPath = (hint?: EnterHostPathHint, intent?: ProjectOpenIntent) => {
		const isCurrent = intent ?? projectOpenIntents.begin();
		if (!isCurrent()) return;
		const next: { reason: string | null; prefilledPath?: string } = {
			reason: hint?.reason ?? null,
		};
		if (hint?.prefilledPath !== undefined) next.prefilledPath = hint.prefilledPath;
		setPathEntry(next);
	};

	const pickAndOpen = async () => {
		const isCurrent = projectOpenIntents.begin();
		let path: string | null;
		try {
			({ path } = await getTransport().request(
				"dialog.selectDirectory",
				{},
				{ timeoutMs: PICK_TIMEOUT_MS },
			));
		} catch (err) {
			if (!isCurrent()) return;
			setPathEntry({ reason: errorText(err, t("panels.openProject.pickerFailed")) });
			return;
		}
		if (!isCurrent()) return;
		if (path) await openProjectForIntent(path, isCurrent);
	};

	const dialogs = (
		<>
			<ConfirmDialog
				open={initTarget !== null}
				onOpenChange={(o) => {
					if (!o) setInitTarget(null);
				}}
				title={t("panels.openProject.initTitle")}
				description={
					<T
						i18nKey="panels.openProject.initDescription"
						values={{ path: initTarget }}
						components={[<span key="path" className="tr-text-emphasis text-text-default" />]}
					/>
				}
				confirmLabel={t("panels.openProject.initConfirm")}
				confirmTestId="confirm-init-repo"
				onConfirm={() => {
					if (initTarget) void initProject(initTarget);
				}}
			/>
			{cloneIntent ? (
				<CloneProjectDialog
					onClose={() => setCloneIntent(null)}
					onCloned={(project) => void adopt(project, cloneIntent.isCurrent)}
				/>
			) : null}
			{creating ? (
				<CreateProjectDialog
					onClose={() => setCreating(false)}
					onCreated={(project, setup) => void adopt(project, projectOpenIntents.begin(), { setup })}
				/>
			) : null}
			<OpenProjectPathDialog
				open={pathEntry !== null}
				reason={pathEntry?.reason ?? null}
				{...(pathEntry?.prefilledPath !== undefined
					? { initialPath: pathEntry.prefilledPath }
					: {})}
				onOpenChange={(open) => {
					if (!open) setPathEntry(null);
				}}
				onSubmit={(path) => void openProject(path)}
			/>
			<NoticeDialog
				open={openError !== null}
				onOpenChange={(o) => {
					if (!o) setOpenError(null);
				}}
				title={t("panels.openProject.openFailed")}
				description={<span className="whitespace-pre-line">{openError}</span>}
				testId="open-error-dialog"
			/>
		</>
	);

	return {
		beginOpenProjectIntent,
		openProject,
		pickAndOpen,
		enterHostPath,
		startNewProject,
		cloneRepository,
		dialogs,
	};
}
