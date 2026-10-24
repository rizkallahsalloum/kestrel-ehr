import { AlertBanner, buttonStyles, PrivateText } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { abnormalVitals, type AbnormalVital } from "../abnormal";
import type { VitalReading } from "../thresholds";
import { VITAL_STATUS_LABEL, VITAL_TILE } from "./vitals-band";

function title(critical: AbnormalVital[]): string {
  const names = critical.map((v) => VITAL_TILE[v.kind].label).join(", ");
  return `Critical vital sign${critical.length === 1 ? "" : "s"} on the latest reading: ${names}`;
}

/**
 * Chart banner for the latest vitals reading when any vital is critical under the demo rules.
 * Warning-only readings get no banner: the tile carries the warning state. When there is a banner
 * it also lists the warning vitals, below the critical ones. It cannot be dismissed: it goes away
 * only when a newer reading has no critical vital. Values are masked under Privacy mode like the
 * tiles; vital names and status words stay visible.
 */
export function AbnormalVitalsBanner({ reading }: { reading: VitalReading | undefined }) {
  if (!reading) return null;
  const abnormal = abnormalVitals(reading);
  const critical = abnormal.filter((v) => v.status === "critical");
  if (critical.length === 0) return null;
  return (
    <AlertBanner
      tone="critical"
      role="alert"
      pulse
      title={title(critical)}
      actions={
        <a href="#vitals-heading" className={buttonStyles({ size: "sm" })}>
          Review vitals
        </a>
      }
    >
      <div data-abnormal-vitals="">
        <p>
          Latest reading{" "}
          <PrivateText label="Reading time" className="whitespace-nowrap">
            {formatDateTime(reading.recorded_at)}
          </PrivateText>
          . Status comes from illustrative demo rules, not clinical guidance.
        </p>
        <ul className="mt-1 list-disc pl-5">
          {abnormal.map((vital) => {
            const tile = VITAL_TILE[vital.kind];
            return (
              <li key={vital.kind} data-vital={vital.kind}>
                {tile.label} <PrivateText label={tile.label}>{tile.value(reading)}</PrivateText> {tile.unit}:{" "}
                <span className="font-semibold">{VITAL_STATUS_LABEL[vital.status]}</span> ({vital.rule.code})
              </li>
            );
          })}
        </ul>
      </div>
    </AlertBanner>
  );
}
