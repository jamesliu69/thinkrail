import type { SessionSpeed } from "@thinkrail/contracts";
import { useT } from "@thinkrail/locales/react";
import { cn } from "@thinkrail/ui/utils";

/** 顯示此對話要求的速度；是否獲得優先處理仍由服務端決定。 */
export function SpeedSelector({
	speed,
	onSelect,
	disabled,
}: {
	speed: SessionSpeed;
	onSelect: (speed: SessionSpeed) => void;
	disabled: boolean;
}) {
	const t = useT();
	return (
		<div
			data-testid="speed-section"
			className="flex shrink-0 flex-col gap-4 border-border-default border-t px-12 py-8"
		>
			<div className="flex items-center justify-between gap-8">
				<span className="text-text-muted tr-text-metadata">{t("chat.modelPicker.speed")}</span>
				<fieldset aria-label={t("chat.modelPicker.speed")} className="flex gap-4">
					{(["standard", "fast"] as const).map((value) => (
						<button
							key={value}
							type="button"
							data-testid={`speed-option-${value}`}
							aria-pressed={speed === value}
							disabled={disabled}
							onClick={() => onSelect(value)}
							className={cn(
								"rounded-sm px-8 py-4 tr-text-metadata outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
								speed === value
									? "bg-control-bg-selected text-text-default"
									: "text-text-muted hover:bg-control-bg-hovered",
							)}
						>
							{t(
								value === "fast" ? "chat.modelPicker.speedFast" : "chat.modelPicker.speedStandard",
							)}
						</button>
					))}
				</fieldset>
			</div>
			<p className="text-text-subtle tr-text-metadata">{t("chat.modelPicker.speedHint")}</p>
		</div>
	);
}
