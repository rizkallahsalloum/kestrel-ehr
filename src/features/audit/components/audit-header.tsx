/** Text classes shared by the audit page and its loading skeleton, so the two keep the same boxes. */
export const auditText = {
  heading: "text-heading-xl font-semibold text-ink",
  intro: "text-body-sm text-ink-secondary",
  table: "text-body-sm",
} as const;

export function AuditIntro() {
  return (
    <p className={auditText.intro}>
      Read-only, append-only record of synthetic clinical activity. Identifiers only; no clinical content is stored in
      audit metadata.
    </p>
  );
}
