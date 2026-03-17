// Standalone script to add 8 test books with real data
// Run with: npx ts-node prisma/add-books.ts

import { PrismaClient, BookCopyStatus } from '@prisma/client';

const prisma = new PrismaClient();

const booksData = [
  {
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    authors: ['Robert C. Martin'],
    isbn: '978-0132350884',
    category: 'Reference',
    description:
      'A handbook of agile software craftsmanship covering clean code principles, meaningful names, functions, comments, formatting, and more.',
    publisher: 'Prentice Hall',
    publicationYear: 2008,
    edition: '1st Edition',
    pageCount: 464,
    language: 'English',
    coverImageUrl:
      'https://m.media-amazon.com/images/I/41xShlnTZTL._SX376_BO1,204,203,200_.jpg',
    subjectTags: ['programming', 'software engineering', 'agile', 'best practices'],
    isEbookAvailable: true,
    ebookUrl:
      'https://github.com/jnguyen095/clean-code/blob/master/Clean.Code.A.Handbook.of.Agile.Software.Craftsmanship.pdf',
  },
  {
    title: 'The Art of War',
    authors: ['Sun Tzu'],
    isbn: '978-1599869773',
    category: 'Non-Fiction',
    description:
      'Ancient Chinese military treatise dating from the 5th century BC. One of the oldest and most successful books on military strategy.',
    publisher: 'Filiquarian',
    publicationYear: -500,
    edition: 'Classic',
    pageCount: 68,
    language: 'English',
    coverImageUrl:
      'https://m.media-amazon.com/images/I/51V1Ys11VML._SX331_BO1,204,203,200_.jpg',
    subjectTags: ['strategy', 'military', 'philosophy', 'leadership'],
    isEbookAvailable: true,
    ebookUrl: 'https://www.gutenberg.org/files/132/132-h/132-h.htm',
  },
  {
    title: 'Think Python: How to Think Like a Computer Scientist',
    authors: ['Allen B. Downey'],
    isbn: '978-1491939369',
    category: 'Textbook',
    description:
      'An introduction to Python programming for beginners. Covers basic concepts, functions, conditionals, recursion, data structures, and object-oriented programming.',
    publisher: "O'Reilly Media",
    publicationYear: 2015,
    edition: '2nd Edition',
    pageCount: 292,
    language: 'English',
    coverImageUrl: 'https://greenteapress.com/thinkpython2/think_python2_medium.jpg',
    subjectTags: ['python', 'programming', 'computer science', 'beginner'],
    isEbookAvailable: true,
    ebookUrl: 'https://greenteapress.com/thinkpython2/thinkpython2.pdf',
  },
  {
    title: 'Pro Git',
    authors: ['Scott Chacon', 'Ben Straub'],
    isbn: '978-1484200773',
    category: 'Reference',
    description:
      'The entire Pro Git book, written by Scott Chacon and Ben Straub, covers everything about Git version control from basics to advanced topics.',
    publisher: 'Apress',
    publicationYear: 2014,
    edition: '2nd Edition',
    pageCount: 456,
    language: 'English',
    coverImageUrl: 'https://git-scm.com/images/progit2.png',
    subjectTags: ['git', 'version control', 'programming', 'devops'],
    isEbookAvailable: true,
    ebookUrl:
      'https://github.com/progit/progit2/releases/download/2.1.360/progit.pdf',
  },
  {
    title: 'Introduction to Algorithms',
    authors: [
      'Thomas H. Cormen',
      'Charles E. Leiserson',
      'Ronald L. Rivest',
      'Clifford Stein',
    ],
    isbn: '978-0262033848',
    category: 'Textbook',
    description:
      'The leading textbook on computer algorithms, covering a broad range of algorithms in depth with mathematical rigor and accessible writing style.',
    publisher: 'MIT Press',
    publicationYear: 2009,
    edition: '3rd Edition',
    pageCount: 1312,
    language: 'English',
    coverImageUrl:
      'https://m.media-amazon.com/images/I/41T0iBxY8FL._SX440_BO1,204,203,200_.jpg',
    subjectTags: ['algorithms', 'data structures', 'computer science', 'mathematics'],
    isEbookAvailable: false,
    ebookUrl: null,
  },
  {
    title: 'Eloquent JavaScript: A Modern Introduction to Programming',
    authors: ['Marijn Haverbeke'],
    isbn: '978-1593279509',
    category: 'Textbook',
    description:
      'A modern introduction to programming with JavaScript. Covers language basics, browser programming, and Node.js.',
    publisher: 'No Starch Press',
    publicationYear: 2018,
    edition: '3rd Edition',
    pageCount: 472,
    language: 'English',
    coverImageUrl: 'https://eloquentjavascript.net/img/cover.jpg',
    subjectTags: ['javascript', 'programming', 'web development', 'node.js'],
    isEbookAvailable: true,
    ebookUrl: 'https://eloquentjavascript.net/Eloquent_JavaScript.pdf',
  },
  {
    title: 'The Linux Command Line',
    authors: ['William Shotts'],
    isbn: '978-1593279523',
    category: 'Reference',
    description:
      'A complete introduction to Linux command line, covering navigation, file manipulation, scripting, and system administration.',
    publisher: 'No Starch Press',
    publicationYear: 2019,
    edition: '2nd Edition',
    pageCount: 504,
    language: 'English',
    coverImageUrl:
      'https://m.media-amazon.com/images/I/51wL+-P8URL._SX376_BO1,204,203,200_.jpg',
    subjectTags: ['linux', 'command line', 'shell', 'bash', 'system administration'],
    isEbookAvailable: true,
    ebookUrl:
      'https://sourceforge.net/projects/linuxcommand/files/TLCL/19.01/TLCL-19.01.pdf/download',
  },
  {
    title: 'Frankenstein; Or, The Modern Prometheus',
    authors: ['Mary Shelley'],
    isbn: '978-0486282114',
    category: 'Fiction',
    description:
      'The classic gothic novel about Victor Frankenstein and the creature he brings to life. One of the earliest examples of science fiction.',
    publisher: 'Dover Publications',
    publicationYear: 1818,
    edition: 'Original',
    pageCount: 280,
    language: 'English',
    coverImageUrl:
      'https://m.media-amazon.com/images/I/81z7E0uWdtL._AC_UF1000,1000_QL80_.jpg',
    subjectTags: ['fiction', 'gothic', 'horror', 'classic', 'science fiction'],
    isEbookAvailable: true,
    ebookUrl: 'https://www.gutenberg.org/files/84/84-h/84-h.htm',
  },
];

async function main() {
  console.log('📚 Adding 8 test books with real data...\n');

  // 1. Fetch all library branches
  const branches = await prisma.libraryBranch.findMany({
    where: { isActive: true },
  });

  if (branches.length === 0) {
    console.error('❌ No library branches found. Run the main seed first.');
    process.exit(1);
  }

  console.log(
    `Found ${branches.length} branches: ${branches.map((b) => b.name).join(', ')}\n`,
  );

  let booksCreated = 0;
  let booksUpdated = 0;
  let copiesCreated = 0;

  for (const bookData of booksData) {
    // Pick a random branch
    const randomBranch = branches[Math.floor(Math.random() * branches.length)];

    // Check if book already exists by ISBN
    const existing = await prisma.book.findUnique({
      where: { isbn: bookData.isbn },
      include: { copies: true },
    });

    if (existing) {
      // Update the existing book with new data
      await prisma.book.update({
        where: { id: existing.id },
        data: {
          title: bookData.title,
          authors: bookData.authors,
          category: bookData.category,
          description: bookData.description,
          publisher: bookData.publisher,
          publicationYear: bookData.publicationYear,
          edition: bookData.edition,
          pageCount: bookData.pageCount,
          language: bookData.language,
          coverImageUrl: bookData.coverImageUrl,
          subjectTags: bookData.subjectTags,
          isEbookAvailable: bookData.isEbookAvailable,
          ebookUrl: bookData.ebookUrl,
          source: 'Manual',
        },
      });

      // Set all existing copies to AVAILABLE
      await prisma.bookCopy.updateMany({
        where: { bookId: existing.id },
        data: { status: BookCopyStatus.AVAILABLE },
      });

      console.log(
        `🔄 Updated: "${bookData.title}" (${existing.copies.length} copies set to AVAILABLE)`,
      );
      booksUpdated++;
    } else {
      // Create new book
      const book = await prisma.book.create({
        data: {
          title: bookData.title,
          authors: bookData.authors,
          isbn: bookData.isbn,
          category: bookData.category,
          description: bookData.description,
          publisher: bookData.publisher,
          publicationYear: bookData.publicationYear,
          edition: bookData.edition,
          pageCount: bookData.pageCount,
          language: bookData.language,
          coverImageUrl: bookData.coverImageUrl,
          subjectTags: bookData.subjectTags,
          isEbookAvailable: bookData.isEbookAvailable,
          ebookUrl: bookData.ebookUrl,
          source: 'Manual',
        },
      });

      // Create 3 copies at the random branch
      const isbnShort = bookData.isbn.replace(/-/g, '').slice(-6);
      for (let i = 1; i <= 3; i++) {
        const branchCode = randomBranch.code.replace('-', '');
        const brandId = `${branchCode}-${isbnShort}-${i.toString().padStart(2, '0')}`;

        await prisma.bookCopy.create({
          data: {
            bookId: book.id,
            branchId: randomBranch.id,
            brandId,
            status: BookCopyStatus.AVAILABLE,
            condition: 'Good',
          },
        });
        copiesCreated++;
      }

      console.log(
        `✅ Created: "${bookData.title}" → ${randomBranch.name} (3 copies)` +
          (bookData.isEbookAvailable ? ' [E-book: ✓]' : ''),
      );
      booksCreated++;
    }
  }

  console.log('\n========================================');
  console.log('📊 Summary:');
  console.log(`   • New books created: ${booksCreated}`);
  console.log(`   • Existing books updated: ${booksUpdated}`);
  console.log(`   • New copies created: ${copiesCreated}`);
  console.log(
    `   • E-books available: ${booksData.filter((b) => b.isEbookAvailable).length}/8`,
  );
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
