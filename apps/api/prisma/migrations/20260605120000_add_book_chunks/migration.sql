CREATE TABLE "book_chunks" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "book_chunks_bookId_chunkIndex_key" ON "book_chunks"("bookId", "chunkIndex");

CREATE INDEX "book_chunks_bookId_idx" ON "book_chunks"("bookId");

CREATE INDEX book_chunks_content_gin
ON book_chunks
USING GIN (to_tsvector('simple', content));

ALTER TABLE "book_chunks"
ADD CONSTRAINT "book_chunks_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "books"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
