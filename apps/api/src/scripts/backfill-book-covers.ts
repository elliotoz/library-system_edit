/**
 * Backfill missing book cover images.
 *
 * For every book where coverImageUrl is null/empty:
 *   1) Try OpenLibrary by ISBN
 *   2) Fallback: OpenLibrary search by title (+first author)
 *   3) Download image and save to uploads/covers/<bookId>.jpg
 *   4) Update DB record
 *
 * Run:  npm run covers:backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const COVERS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'covers');
const REQUEST_TIMEOUT_MS = 10_000;
const DELAY_BETWEEN_MS = 500; // be polite to OpenLibrary

interface Stats {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try to find a cover URL via OpenLibrary.
 * Returns the image URL string or null.
 */
async function findCoverUrl(
  isbn: string | null,
  title: string,
  authors: string[],
): Promise<string | null> {
  // 1) ISBN lookup — direct cover endpoint
  if (isbn) {
    const cleanIsbn = isbn.replace(/-/g, '');
    const checkUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg?default=false`;
    try {
      const res = await fetchWithTimeout(checkUrl);
      if (res.ok) {
        // Return the large version for better quality before we compress
        return `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
      }
    } catch {
      // fall through to search
    }
  }

  // 2) Search by title (+author)
  try {
    let query = encodeURIComponent(title);
    if (authors.length > 0) {
      query += `+${encodeURIComponent(authors[0])}`;
    }
    const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=1&fields=cover_i`;
    const res = await fetchWithTimeout(searchUrl);
    if (!res.ok) return null;

    const data = (await res.json()) as { docs?: { cover_i?: number }[] };
    const coverId = data.docs?.[0]?.cover_i;
    if (coverId) {
      return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
    }
  } catch {
    // no match
  }

  return null;
}

async function downloadImage(
  imageUrl: string,
  destPath: string,
): Promise<void> {
  const res = await fetchWithTimeout(imageUrl);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${imageUrl}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function main() {
  console.log('--- Book Cover Backfill ---\n');

  // Ensure output directory
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  const books = await prisma.book.findMany({
    where: {
      OR: [{ coverImageUrl: null }, { coverImageUrl: '' }],
    },
    select: {
      id: true,
      title: true,
      authors: true,
      isbn: true,
    },
  });

  console.log(`Found ${books.length} book(s) without covers.\n`);

  const stats: Stats = { processed: 0, updated: 0, skipped: 0, errors: 0 };

  for (const book of books) {
    stats.processed++;
    const label = `[${stats.processed}/${books.length}] "${book.title}"`;

    try {
      const coverUrl = await findCoverUrl(book.isbn, book.title, book.authors);

      if (!coverUrl) {
        console.log(`${label} — no cover found, skipping`);
        stats.skipped++;
        await sleep(DELAY_BETWEEN_MS);
        continue;
      }

      const destFile = path.join(COVERS_DIR, `${book.id}.jpg`);
      await downloadImage(coverUrl, destFile);

      const dbPath = `/uploads/covers/${book.id}.jpg`;
      await prisma.book.update({
        where: { id: book.id },
        data: { coverImageUrl: dbPath },
      });

      console.log(`${label} — saved`);
      stats.updated++;
    } catch (err: any) {
      console.error(`${label} — ERROR: ${err.message}`);
      stats.errors++;
    }

    await sleep(DELAY_BETWEEN_MS);
  }

  console.log('\n--- Summary ---');
  console.log(`  Processed : ${stats.processed}`);
  console.log(`  Updated   : ${stats.updated}`);
  console.log(`  Skipped   : ${stats.skipped}`);
  console.log(`  Errors    : ${stats.errors}`);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
