// Lower-case, without the trailing full stop. "د" is the Arabic abbreviation for doctor.
const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "mx", "miss", "prof", "sir", "dame", "rev", "fr", "sr", "sra", "pr", "د"]);
const SUFFIXES = new Set([
  "md",
  "do",
  "phd",
  "pa",
  "pa-c",
  "np",
  "rn",
  "lpn",
  "dds",
  "dmd",
  "mbbs",
  "mbchb",
  "frcp",
  "mph",
  "msc",
  "bsc",
  "pharmd",
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "esq",
]);

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** First user-perceived character, so combining marks and non-Latin scripts stay whole. */
function firstGrapheme(word: string): string {
  if (segmenter) {
    for (const { segment } of segmenter.segment(word)) return segment;
    return "";
  }
  return Array.from(word)[0] ?? "";
}

function normalized(word: string): string {
  return word.replace(/\.+$/, "").toLowerCase();
}

/**
 * Initials for an avatar: first letter of the first name and of the last name, or one letter for a
 * single name. Honorifics (Dr., Prof.), suffixes (MD, PA-C, Jr.) and anything in parentheses or
 * brackets are ignored. Returns "" when nothing usable is left.
 */
export function getInitials(name: string): string {
  const words = name
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .split(/[\s,]+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.-]+$/gu, ""))
    .filter((word) => /[\p{L}\p{N}]/u.test(word));

  while (words.length > 1 && HONORIFICS.has(normalized(words[0]!))) words.shift();
  while (words.length > 1 && SUFFIXES.has(normalized(words.at(-1)!))) words.pop();
  if (words.length === 1 && (HONORIFICS.has(normalized(words[0]!)) || SUFFIXES.has(normalized(words[0]!)))) {
    return "";
  }

  const first = words[0];
  if (!first) return "";
  const last = words.length > 1 ? words.at(-1)! : "";
  return `${firstGrapheme(first)}${last ? firstGrapheme(last) : ""}`.toLocaleUpperCase();
}
