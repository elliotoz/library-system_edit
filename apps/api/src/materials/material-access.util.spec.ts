import { AccessLevel, Role } from '@prisma/client';
import { buildMaterialAccessWhere, canAccessMaterial, MaterialAccessContext } from './material-access.util';

describe('material-access.util', () => {
  const studentContext: MaterialAccessContext = {
    userId: 'user-1',
    role: Role.STUDENT,
    facultyCode: 'ENG',
    courseCodes: ['CS101', 'MATH201'],
  };

  it('allows public materials', () => {
    expect(
      canAccessMaterial(
        {
          accessLevel: AccessLevel.PUBLIC,
          facultyCode: null,
          courseCode: null,
          uploadedById: 'other-user',
        },
        studentContext,
      ),
    ).toBe(true);
  });

  it('allows faculty-only materials for matching faculty', () => {
    expect(
      canAccessMaterial(
        {
          accessLevel: AccessLevel.FACULTY_ONLY,
          facultyCode: 'ENG',
          courseCode: null,
          uploadedById: 'other-user',
        },
        studentContext,
      ),
    ).toBe(true);
  });

  it('allows course-student materials for enrolled courses only', () => {
    expect(
      canAccessMaterial(
        {
          accessLevel: AccessLevel.COURSE_STUDENTS,
          facultyCode: null,
          courseCode: 'CS101',
          uploadedById: 'other-user',
        },
        studentContext,
      ),
    ).toBe(true);

    expect(
      canAccessMaterial(
        {
          accessLevel: AccessLevel.COURSE_STUDENTS,
          facultyCode: null,
          courseCode: 'BIO101',
          uploadedById: 'other-user',
        },
        studentContext,
      ),
    ).toBe(false);
  });

  it('always allows admins and upload owners', () => {
    const adminContext: MaterialAccessContext = {
      userId: 'admin-1',
      role: Role.ADMIN,
      facultyCode: null,
      courseCodes: [],
    };

    expect(
      canAccessMaterial(
        {
          accessLevel: AccessLevel.COURSE_STUDENTS,
          facultyCode: null,
          courseCode: 'BIO101',
          uploadedById: 'other-user',
        },
        adminContext,
      ),
    ).toBe(true);

    expect(
      canAccessMaterial(
        {
          accessLevel: AccessLevel.FACULTY_ONLY,
          facultyCode: 'MED',
          courseCode: null,
          uploadedById: 'user-1',
        },
        studentContext,
      ),
    ).toBe(true);
  });

  it('builds a user-scoped Prisma where filter', () => {
    expect(buildMaterialAccessWhere(studentContext)).toEqual({
      OR: [
        { uploadedById: 'user-1' },
        { accessLevel: AccessLevel.PUBLIC },
        { accessLevel: AccessLevel.FACULTY_ONLY, facultyCode: 'ENG' },
        { accessLevel: AccessLevel.COURSE_STUDENTS, courseCode: { in: ['CS101', 'MATH201'] } },
      ],
    });
  });
});
