/**
 * Shared product search string handling for PostgreSQL full-text and trigram search.
 */

export function normalizeProductSearchQuery(query: string | undefined): string {
  if (!query) return '';
  return query.replace(/\s+/g, ' ').trim();
}

/**
 * Bidirectional synonym groups for query expansion. Two cases:
 * irregular plurals the English stemmer keeps distinct (man/men, woman/women),
 * and compound spelling variants Postgres tokenizes into different lexemes
 * (concatenated "tshirt" vs hyphenated "t-shirt"). The spaced "t shirt" needs
 * no entry — to_tsvector already indexes "t-shirt" as its parts t + shirt.
 */
const SEARCH_SYNONYM_GROUPS: readonly string[][] = [
  ['man', 'men'],
  ['woman', 'women'],
  ['t-shirt', 'tshirt', 'tshirts'],
];

/** All equivalents of a term (lowercased), or just the term itself. */
function expandSynonyms(term: string): string[] {
  const lower = term.toLowerCase();
  const group = SEARCH_SYNONYM_GROUPS.find((g) => g.includes(lower));
  return group ? [...group] : [term];
}

/**
 * Prefix tsquery string: "nike air" -> "nike:* & air:*", or null when search
 * should be omitted. Hyphenated compounds stay intact so to_tsquery uses the
 * same parser as to_tsvector ("t-shirt" -> "t-shirt:*", not "t:* & shirt:*").
 * Other punctuation splits terms, leaving tokens free of tsquery syntax.
 * Synonyms expand to an OR group, e.g. "man" -> "(man:* | men:*)". The result
 * must always be passed as a bound parameter to to_tsquery('english', ...).
 */
export function productSearchTsQuery(query: string | undefined): string | null {
  const normalized = normalizeProductSearchQuery(query);
  if (!normalized) return null;
  const terms = normalized
    .split(/[^\p{L}\p{N}-]+/u)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter(Boolean);
  if (!terms.length) return null;
  return terms
    .map((t) => {
      const prefixes = expandSynonyms(t).map((w) => `${w}:*`);
      return prefixes.length > 1 ? `(${prefixes.join(' | ')})` : prefixes[0];
    })
    .join(' & ');
}

/**
 * Minimum word_similarity() for the trigram fallback. The pg_trgm default of
 * 0.6 misses common typos ("nikee" vs "Nike" scores ~0.5).
 */
export const FUZZY_WORD_SIMILARITY_THRESHOLD = 0.3;

function escapePostgresLikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Substring ILIKE pattern `%…%`, or null when search should be omitted.
 * Used by the admin product table; storefront search uses FTS instead.
 */
export function productSearchIlikePattern(
  query: string | undefined,
): string | null {
  const normalized = normalizeProductSearchQuery(query);
  if (!normalized) return null;
  return `%${escapePostgresLikePattern(normalized)}%`;
}

/**
 * Exact ILIKE pattern for the gender column (no `%`). E.g. "men" matches `men`
 * but not `women`, unlike substring search on gender.
 */
export function productSearchGenderExactIlikePattern(
  query: string | undefined,
): string | null {
  const normalized = normalizeProductSearchQuery(query);
  if (!normalized) return null;
  return escapePostgresLikePattern(normalized);
}
