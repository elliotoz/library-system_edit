/**
 * Shared types for the AI search subsystem.
 *
 * Extracted so that SemanticSearchService, CatalogSearchService,
 * LearningPathService, and ResearchAssistantService can all depend
 * on a single source of truth — no circular imports.
 */

// ── Search intent (parsed from natural-language message) ─────────

export interface SearchIntent {
  keywords: string[];
  wantsAvailable: boolean;
  wantsReadingLists: boolean;
  category: string | null;
  audienceLevel: 'introductory' | 'advanced' | null;
  facultyHint: string | null;
}

// ── Raw candidate returned by the DB query ───────────────────────

export interface BookCandidate {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
  description: string | null;
  subjectTags: string[];
  mainFaculty: { name: string } | null;
  copies: { status: string }[];
  _count: { readingListItems: number };
}

// ── Scored / ranked result ready for presentation ────────────────

export interface RankedBookResult {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
  subjectTags: string[];
  availableCopies: number;
  totalCopies: number;
  readingListCount: number;
  facultyMatch: boolean;
  score: number;
  reasons: string[];
}

// ── Contextual hints passed alongside intent ─────────────────────

export interface SearchContext {
  facultyName: string | null;
}

// ── Reading list result ──────────────────────────────────────────

export interface ReadingListResult {
  id: string;
  title: string;
  ownerName: string;
  itemCount: number;
}
