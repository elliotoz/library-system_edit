// prisma/seed.ts
// Seed script for AI-Integrated University Library System
// Run with: npx prisma db seed

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Default password for seeded dev accounts
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
  console.log('👥 Creating users...');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // STUDENTS
  const students = await Promise.all([
    // Engineering Students
    prisma.user.create({
      data: {
        name: 'Efe Demir',
        email: 'efe.demir@std.uskudar.edu.tr',
        password: hashedPassword,
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
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
        emailVerifiedAt: new Date(),
        role: Role.ADMIN,
        staffId: 'LIB-ADMIN-001',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Chief Librarian',
        email: 'librarian@uskudar.edu.tr',
        password: hashedPassword,
        emailVerifiedAt: new Date(),
        role: Role.ADMIN,
        staffId: 'LIB-ADMIN-002',
      },
    }),
  ]);

  console.log(`   ✅ Created ${admins.length} admins`);
  console.log(`✅ Total users created: ${students.length + instructors.length + staffMembers.length + admins.length}\n`);

  // Catalog books, book copies, and borrows are intentionally not seeded.
  // Add real catalog books and PDFs through the Admin UI.
  const booksCreated = 0;
  const bookCopiesCreated = 0;

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
  console.log(`   • Books: ${booksCreated}`);
  console.log(`   • Book Copies: ${bookCopiesCreated}`);
  console.log('\n📧 Seeded Login Accounts (dev only):');
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
