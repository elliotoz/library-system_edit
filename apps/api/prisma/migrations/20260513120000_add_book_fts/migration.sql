-- Add full-text search vector column to books table
-- Uses PostgreSQL tsvector with weighted fields:
--   A = title (highest relevance), B = category/authors/tags, C = description (lowest)
ALTER TABLE books ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN index for fast FTS queries (orders of magnitude faster than sequential scan)
CREATE INDEX IF NOT EXISTS book_search_vector_idx ON books USING GIN (search_vector);

-- Trigger function: auto-updates search_vector on every INSERT or UPDATE
CREATE OR REPLACE FUNCTION update_book_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.authors, ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW."subjectTags", ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to books table
DROP TRIGGER IF EXISTS book_search_vector_update ON books;
CREATE TRIGGER book_search_vector_update
  BEFORE INSERT OR UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_book_search_vector();

-- Backfill existing rows (trigger only fires on future writes)
UPDATE books SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', array_to_string(authors, ' ')), 'B') ||
  setweight(to_tsvector('english', array_to_string("subjectTags", ' ')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C');
