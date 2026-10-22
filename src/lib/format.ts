export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

/** Age in whole years on `today` (UTC). */
export function ageInYears(dateOfBirth: string, today: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const SEX_SHORT: Record<string, string> = { female: "F", male: "M" };

/** Chart demographics: "62F" / "62M", or "62 unknown" when there is no one-letter code. */
export function formatAgeSex(dateOfBirth: string, sex: string, today: Date = new Date()): string {
  const age = ageInYears(dateOfBirth, today);
  const short = SEX_SHORT[sex];
  return short ? `${age}${short}` : `${age} ${humanize(sex)}`;
}

export function humanize(value: string): string {
  return value.replace(/_/g, " ");
}
