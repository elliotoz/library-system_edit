// prisma/seed.ts
// Seed script for AI-Integrated University Library System
// Run with: npx prisma db seed

import { PrismaClient, Role, BookCopyStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Password for all demo accounts
const DEFAULT_PASSWORD = 'password123';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // 1. CLEAR EXISTING DATA
  // ============================================
  console.log('🗑️  Clearing existing data...');
  await prisma.borrow.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.bookCopy.deleteMany();
  await prisma.book.deleteMany();
  await prisma.material.deleteMany();
  await prisma.borrowPolicy.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.libraryBranch.deleteMany();
  console.log('✅ Cleared existing data\n');

  // ============================================
  // 2. CREATE LIBRARY BRANCHES (CAMPUSES)
  // ============================================
  console.log('🏛️  Creating library branches...');
  
  const branches = await Promise.all([
    prisma.libraryBranch.create({
      data: {
        name: 'Altunizade Merkez Campus Library',
        code: 'ALT-MERKEZ',
        address: 'Altunizade Mh. Üniversite Sokağı No:14, 34662 Üsküdar / İstanbul',
        openingHours: 'Mon-Fri: 08:00-22:00, Sat-Sun: 10:00-18:00',
        contactEmail: 'library.merkez@uskudar.edu.tr',
        contactPhone: '+90 216 400 22 22',
      },
    }),
    prisma.libraryBranch.create({
      data: {
        name: 'Altunizade South Campus Library',
        code: 'ALT-SOUTH',
        address: 'Altunizade Mh. Mahir İz Cd. No:23, Üsküdar / İstanbul',
        openingHours: 'Mon-Fri: 08:30-20:00, Sat: 10:00-16:00',
        contactEmail: 'library.south@uskudar.edu.tr',
        contactPhone: '+90 216 400 22 23',
      },
    }),
    prisma.libraryBranch.create({
      data: {
        name: 'Üsküdar Çarşı Campus Library',
        code: 'USK-CARSI',
        address: 'Mimar Sinan Mah. Selman-ı Pak Cad., Üsküdar / İstanbul',
        openingHours: 'Mon-Fri: 09:00-19:00',
        contactEmail: 'library.carsi@uskudar.edu.tr',
        contactPhone: '+90 216 400 22 24',
      },
    }),
    prisma.libraryBranch.create({
      data: {
        name: 'NP Health Campus Library',
        code: 'NP-HEALTH',
        address: 'Ahmet Tevfik İleri Cad. No:5, Ümraniye / İstanbul',
        openingHours: 'Mon-Fri: 08:00-20:00, Sat: 09:00-17:00',
        contactEmail: 'library.nphealth@uskudar.edu.tr',
        contactPhone: '+90 216 400 22 25',
      },
    }),
    prisma.libraryBranch.create({
      data: {
        name: 'Medical Faculty NP Campus Library',
        code: 'NP-MED',
        address: 'Site Yolu Cad. No:27, Ümraniye / İstanbul',
        openingHours: 'Mon-Sun: 07:00-23:00',
        contactEmail: 'library.medicine@uskudar.edu.tr',
        contactPhone: '+90 216 400 22 26',
      },
    }),
  ]);

  const [altMerkez, altSouth, uskCarsi, npHealth, npMed] = branches;
  console.log(`✅ Created ${branches.length} library branches\n`);

  // ============================================
  // 3. CREATE FACULTIES
  // ============================================
  console.log('🎓 Creating faculties...');

  const faculties = await Promise.all([
    prisma.faculty.create({
      data: {
        name: 'Engineering and Natural Sciences',
        code: 'FENS',
        description: 'Faculty of Engineering and Natural Sciences',
        defaultBranchId: altMerkez.id,
      },
    }),
    prisma.faculty.create({
      data: {
        name: 'Communication',
        code: 'COMM',
        description: 'Faculty of Communication',
        defaultBranchId: altSouth.id,
      },
    }),
    prisma.faculty.create({
      data: {
        name: 'Humanities and Social Sciences',
        code: 'HSS',
        description: 'Faculty of Humanities and Social Sciences',
        defaultBranchId: altSouth.id,
      },
    }),
    prisma.faculty.create({
      data: {
        name: 'Health Sciences',
        code: 'HS',
        description: 'Faculty of Health Sciences',
        defaultBranchId: uskCarsi.id,
      },
    }),
    prisma.faculty.create({
      data: {
        name: 'Dentistry',
        code: 'DENT',
        description: 'Faculty of Dentistry',
        defaultBranchId: npHealth.id,
      },
    }),
    prisma.faculty.create({
      data: {
        name: 'Medicine',
        code: 'MED',
        description: 'Faculty of Medicine',
        defaultBranchId: npMed.id,
      },
    }),
  ]);

  const [fensFaculty, commFaculty, hssFaculty, hsFaculty, dentFaculty, medFaculty] = faculties;
  console.log(`✅ Created ${faculties.length} faculties\n`);

  // ============================================
  // 4. CREATE BORROW POLICIES
  // ============================================
  console.log('📋 Creating borrow policies...');

  await Promise.all([
    prisma.borrowPolicy.create({
      data: {
        role: Role.STUDENT,
        maxActiveBorrows: 5,
        maxBorrowDays: 14,
        maxExtensions: 2,
        extensionDays: 7,
        description: 'Standard student borrowing policy',
      },
    }),
    prisma.borrowPolicy.create({
      data: {
        role: Role.INSTRUCTOR,
        maxActiveBorrows: 10,
        maxBorrowDays: 30,
        maxExtensions: 3,
        extensionDays: 14,
        description: 'Extended borrowing privileges for instructors',
      },
    }),
    prisma.borrowPolicy.create({
      data: {
        role: Role.STAFF,
        maxActiveBorrows: 5,
        maxBorrowDays: 14,
        maxExtensions: 2,
        extensionDays: 7,
        description: 'Standard staff borrowing policy',
      },
    }),
    prisma.borrowPolicy.create({
      data: {
        role: Role.ADMIN,
        maxActiveBorrows: 20,
        maxBorrowDays: 60,
        maxExtensions: 5,
        extensionDays: 30,
        description: 'Administrative borrowing privileges',
      },
    }),
  ]);

  console.log('✅ Created borrow policies for all roles\n');

  // ============================================
  // 5. CREATE USERS
  // ============================================
  console.log('👥 Creating demo users...');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // STUDENTS
  const students = await Promise.all([
    // Engineering Students
    prisma.user.create({
      data: {
        name: 'Efe Demir',
        email: 'efe.demir@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220210001',
        facultyId: fensFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sena Yılmaz',
        email: 'sena.yilmaz@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220210002',
        facultyId: fensFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Ahmet Kaya',
        email: 'ahmet.kaya@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220210003',
        facultyId: fensFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Elif Öztürk',
        email: 'elif.ozturk@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220210004',
        facultyId: fensFaculty.id,
      },
    }),
    // Communication Students
    prisma.user.create({
      data: {
        name: 'Zehra Aksoy',
        email: 'zehra.aksoy@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220310001',
        facultyId: commFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Can Yıldırım',
        email: 'can.yildirim@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220310002',
        facultyId: commFaculty.id,
      },
    }),
    // Health Sciences Students
    prisma.user.create({
      data: {
        name: 'Mehmet Acar',
        email: 'mehmet.acar@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220410001',
        facultyId: hsFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Aylin Çelik',
        email: 'aylin.celik@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220410002',
        facultyId: hsFaculty.id,
      },
    }),
    // Medicine Students
    prisma.user.create({
      data: {
        name: 'Selin Erbaş',
        email: 'selin.erbas@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220510001',
        facultyId: medFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Burak Şen',
        email: 'burak.sen@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220510002',
        facultyId: medFaculty.id,
      },
    }),
    // Humanities Students
    prisma.user.create({
      data: {
        name: 'Deniz Korkmaz',
        email: 'deniz.korkmaz@std.uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STUDENT,
        studentId: '220610001',
        facultyId: hssFaculty.id,
      },
    }),
  ]);

  console.log(`   ✅ Created ${students.length} students`);

  // INSTRUCTORS
  const instructors = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Dr. Kemal Şahin',
        email: 'kemal.sahin@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.INSTRUCTOR,
        staffId: 'FENS-INST-001',
        facultyId: fensFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Dr. Emine Çelik',
        email: 'emine.celik@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.INSTRUCTOR,
        staffId: 'COMM-INST-001',
        facultyId: commFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Dr. Hasan Korkmaz',
        email: 'hasan.korkmaz@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.INSTRUCTOR,
        staffId: 'HS-INST-001',
        facultyId: hsFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Prof. Dr. Fatma Yılmaz',
        email: 'fatma.yilmaz@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.INSTRUCTOR,
        staffId: 'MED-INST-001',
        facultyId: medFaculty.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Dr. Ali Demir',
        email: 'ali.demir@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.INSTRUCTOR,
        staffId: 'HSS-INST-001',
        facultyId: hssFaculty.id,
      },
    }),
  ]);

  console.log(`   ✅ Created ${instructors.length} instructors`);

  // STAFF (No faculty, has interests)
  const staffMembers = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Ayşe Yıldız',
        email: 'ayse.yildiz@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STAFF,
        staffId: 'LIB-STF-001',
        interests: ['Psychology', 'Personal Finance', 'Self-Improvement'],
      },
    }),
    prisma.user.create({
      data: {
        name: 'Murat Özkan',
        email: 'murat.ozkan@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STAFF,
        staffId: 'LIB-STF-002',
        interests: ['History', 'Philosophy', 'Religion'],
      },
    }),
    prisma.user.create({
      data: {
        name: 'Zeynep Kara',
        email: 'zeynep.kara@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.STAFF,
        staffId: 'LIB-STF-003',
        interests: ['Health & Wellness', 'Cooking', 'Travel'],
      },
    }),
  ]);

  console.log(`   ✅ Created ${staffMembers.length} staff members`);

  // ADMINS
  const admins = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Library Admin',
        email: 'admin@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.ADMIN,
        staffId: 'LIB-ADMIN-001',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Chief Librarian',
        email: 'librarian@uskudar.edu.tr',
        password: hashedPassword,
        role: Role.ADMIN,
        staffId: 'LIB-ADMIN-002',
      },
    }),
  ]);

  console.log(`   ✅ Created ${admins.length} admins`);
  console.log(`✅ Total users created: ${students.length + instructors.length + staffMembers.length + admins.length}\n`);

  // ============================================
  // 6. CREATE SAMPLE BOOKS
  // ============================================
  console.log('📚 Creating sample books...');

  const books = await Promise.all([
    // Engineering Books
    prisma.book.create({
      data: {
        title: 'Introduction to Algorithms',
        authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
        isbn: '978-0262033848',
        description: 'A comprehensive introduction to the modern study of computer algorithms.',
        publisher: 'MIT Press',
        publicationYear: 2022,
        edition: '4th Edition',
        pageCount: 1312,
        mainFacultyId: fensFaculty.id,
        subjectTags: ['Algorithms', 'Computer Science', 'Data Structures', 'Programming'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        authors: ['Robert C. Martin'],
        isbn: '978-0132350884',
        description: 'A handbook of agile software craftsmanship.',
        publisher: 'Prentice Hall',
        publicationYear: 2019,
        pageCount: 464,
        mainFacultyId: fensFaculty.id,
        subjectTags: ['Software Engineering', 'Programming', 'Best Practices'],
        category: 'Reference',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
        authors: ['Erich Gamma', 'Richard Helm', 'Ralph Johnson', 'John Vlissides'],
        isbn: '978-0201633610',
        description: 'The classic book on software design patterns.',
        publisher: 'Addison-Wesley',
        publicationYear: 2018,
        pageCount: 416,
        mainFacultyId: fensFaculty.id,
        subjectTags: ['Design Patterns', 'OOP', 'Software Architecture'],
        category: 'Reference',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Computer Networks',
        authors: ['Andrew S. Tanenbaum', 'David J. Wetherall'],
        isbn: '978-0132126953',
        description: 'Comprehensive coverage of computer networks.',
        publisher: 'Pearson',
        publicationYear: 2021,
        edition: '6th Edition',
        pageCount: 960,
        mainFacultyId: fensFaculty.id,
        subjectTags: ['Networks', 'Computer Science', 'Internet', 'Protocols'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Operating System Concepts',
        authors: ['Abraham Silberschatz', 'Peter B. Galvin', 'Greg Gagne'],
        isbn: '978-1119800361',
        description: 'The definitive guide to operating system concepts.',
        publisher: 'Wiley',
        publicationYear: 2021,
        edition: '10th Edition',
        pageCount: 944,
        mainFacultyId: fensFaculty.id,
        subjectTags: ['Operating Systems', 'Computer Science', 'Systems Programming'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    // Communication Books
    prisma.book.create({
      data: {
        title: 'Introduction to New Media',
        authors: ['Lev Manovich'],
        isbn: '978-0262632553',
        description: 'A comprehensive look at new media theory.',
        publisher: 'MIT Press',
        publicationYear: 2020,
        pageCount: 368,
        mainFacultyId: commFaculty.id,
        subjectTags: ['New Media', 'Digital Culture', 'Communication'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Film Art: An Introduction',
        authors: ['David Bordwell', 'Kristin Thompson'],
        isbn: '978-1259534959',
        description: 'The best-selling introduction to film studies.',
        publisher: 'McGraw-Hill',
        publicationYear: 2019,
        edition: '12th Edition',
        pageCount: 544,
        mainFacultyId: commFaculty.id,
        subjectTags: ['Film', 'Cinema', 'Media Studies', 'Visual Arts'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    // Psychology/Humanities Books
    prisma.book.create({
      data: {
        title: 'Introduction to Psychology',
        authors: ['James W. Kalat'],
        isbn: '978-0357371398',
        description: 'A comprehensive introduction to psychology.',
        publisher: 'Cengage',
        publicationYear: 2021,
        edition: '12th Edition',
        pageCount: 640,
        mainFacultyId: hssFaculty.id,
        subjectTags: ['Psychology', 'Behavioral Science', 'Mental Health'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Thinking, Fast and Slow',
        authors: ['Daniel Kahneman'],
        isbn: '978-0374533557',
        description: 'A groundbreaking exploration of the mind and decision-making.',
        publisher: 'Farrar, Straus and Giroux',
        publicationYear: 2011,
        pageCount: 512,
        mainFacultyId: hssFaculty.id,
        subjectTags: ['Psychology', 'Decision Making', 'Behavioral Economics'],
        category: 'General',
        source: 'Manual',
      },
    }),
    // Medical Books
    prisma.book.create({
      data: {
        title: "Gray's Anatomy",
        authors: ['Susan Standring'],
        isbn: '978-0702077050',
        description: 'The classic anatomy reference for medical students.',
        publisher: 'Elsevier',
        publicationYear: 2020,
        edition: '42nd Edition',
        pageCount: 1606,
        mainFacultyId: medFaculty.id,
        subjectTags: ['Anatomy', 'Medicine', 'Medical Reference'],
        category: 'Reference',
        source: 'Manual',
      },
    }),
    prisma.book.create({
      data: {
        title: 'Robbins & Cotran Pathologic Basis of Disease',
        authors: ['Vinay Kumar', 'Abul K. Abbas', 'Jon C. Aster'],
        isbn: '978-0323531139',
        description: 'The authoritative pathology textbook.',
        publisher: 'Elsevier',
        publicationYear: 2020,
        edition: '10th Edition',
        pageCount: 1392,
        mainFacultyId: medFaculty.id,
        subjectTags: ['Pathology', 'Medicine', 'Disease'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
    // Health Sciences Books
    prisma.book.create({
      data: {
        title: 'Fundamentals of Nursing',
        authors: ['Patricia A. Potter', 'Anne Griffin Perry'],
        isbn: '978-0323677721',
        description: 'Comprehensive nursing fundamentals textbook.',
        publisher: 'Elsevier',
        publicationYear: 2021,
        edition: '10th Edition',
        pageCount: 1392,
        mainFacultyId: hsFaculty.id,
        subjectTags: ['Nursing', 'Healthcare', 'Patient Care'],
        category: 'Textbook',
        source: 'Manual',
      },
    }),
  ]);

  console.log(`✅ Created ${books.length} books\n`);

  // ============================================
  // 7. CREATE BOOK COPIES
  // ============================================
  console.log('📖 Creating book copies...');

  let copyCount = 0;

  for (const book of books) {
    // Determine which branch based on faculty
    let primaryBranch = altMerkez;
    if (book.mainFacultyId === commFaculty.id || book.mainFacultyId === hssFaculty.id) {
      primaryBranch = altSouth;
    } else if (book.mainFacultyId === hsFaculty.id) {
      primaryBranch = uskCarsi;
    } else if (book.mainFacultyId === dentFaculty.id) {
      primaryBranch = npHealth;
    } else if (book.mainFacultyId === medFaculty.id) {
      primaryBranch = npMed;
    }

    // Create 3-5 copies per book
    const numCopies = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 1; i <= numCopies; i++) {
      const branchCode = primaryBranch.code.replace('-', '');
      const brandId = `${branchCode}-${book.isbn?.replace(/-/g, '').slice(-6) || 'NOIBSN'}-${i.toString().padStart(2, '0')}`;
      
      await prisma.bookCopy.create({
        data: {
          bookId: book.id,
          branchId: primaryBranch.id,
          brandId: brandId,
          status: i === 1 ? BookCopyStatus.BORROWED : BookCopyStatus.AVAILABLE,
          condition: 'Good',
          isDemo: true,
        },
      });
      copyCount++;
    }
  }

  console.log(`✅ Created ${copyCount} book copies\n`);

  // ============================================
  // 8. CREATE SAMPLE BORROWS
  // ============================================
  console.log('📝 Creating sample borrows...');

  // Get first student and first book copy
  const firstStudent = students[0];
  const firstBookCopies = await prisma.bookCopy.findMany({
    where: { status: BookCopyStatus.BORROWED },
    take: 3,
  });

  for (const copy of firstBookCopies) {
    await prisma.borrow.create({
      data: {
        userId: firstStudent.id,
        bookCopyId: copy.id,
        borrowedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'ACTIVE',
      },
    });
  }

  console.log(`✅ Created ${firstBookCopies.length} sample borrows\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('========================================');
  console.log('🎉 Database seeding completed!');
  console.log('========================================\n');
  console.log('📊 Summary:');
  console.log(`   • Library Branches: ${branches.length}`);
  console.log(`   • Faculties: ${faculties.length}`);
  console.log(`   • Students: ${students.length}`);
  console.log(`   • Instructors: ${instructors.length}`);
  console.log(`   • Staff: ${staffMembers.length}`);
  console.log(`   • Admins: ${admins.length}`);
  console.log(`   • Books: ${books.length}`);
  console.log(`   • Book Copies: ${copyCount}`);
  console.log('\n📧 Demo Login Accounts:');
  console.log('   ┌─────────────┬────────────────────────────────────────┬──────────────┐');
  console.log('   │ Role        │ Email                                  │ Password     │');
  console.log('   ├─────────────┼────────────────────────────────────────┼──────────────┤');
  console.log('   │ Student     │ efe.demir@std.uskudar.edu.tr          │ password123  │');
  console.log('   │ Instructor  │ kemal.sahin@uskudar.edu.tr            │ password123  │');
  console.log('   │ Staff       │ ayse.yildiz@uskudar.edu.tr            │ password123  │');
  console.log('   │ Admin       │ admin@uskudar.edu.tr                  │ password123  │');
  console.log('   └─────────────┴────────────────────────────────────────┴──────────────┘');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
