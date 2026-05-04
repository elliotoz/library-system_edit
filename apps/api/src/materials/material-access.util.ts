import { AccessLevel, Prisma, Role } from "@prisma/client";

export interface MaterialAccessContext {
  userId: string;
  role: Role;
  facultyCode: string | null;
  courseCodes: string[];
}

type AccessControlledMaterial = {
  accessLevel: AccessLevel;
  facultyCode: string | null;
  courseCode: string | null;
  uploadedById: string;
};

export function isPrivilegedMaterialRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STAFF;
}

export function canAccessMaterial(
  material: AccessControlledMaterial,
  context: MaterialAccessContext
): boolean {
  if (isPrivilegedMaterialRole(context.role)) {
    return true;
  }

  if (material.uploadedById === context.userId) {
    return true;
  }

  if (material.accessLevel === AccessLevel.PUBLIC) {
    return true;
  }

  if (
    material.accessLevel === AccessLevel.FACULTY_ONLY &&
    material.facultyCode &&
    context.facultyCode === material.facultyCode
  ) {
    return true;
  }

  if (
    material.accessLevel === AccessLevel.COURSE_STUDENTS &&
    material.courseCode &&
    context.courseCodes.includes(material.courseCode)
  ) {
    return true;
  }

  return false;
}

export function buildMaterialAccessWhere(
  context: MaterialAccessContext
): Prisma.MaterialWhereInput {
  if (isPrivilegedMaterialRole(context.role)) {
    return {};
  }

  const accessFilters: Prisma.MaterialWhereInput[] = [
    { uploadedById: context.userId },
    { accessLevel: AccessLevel.PUBLIC },
  ];

  if (context.facultyCode) {
    accessFilters.push({
      accessLevel: AccessLevel.FACULTY_ONLY,
      facultyCode: context.facultyCode,
    });
  }

  if (context.courseCodes.length > 0) {
    accessFilters.push({
      accessLevel: AccessLevel.COURSE_STUDENTS,
      courseCode: { in: context.courseCodes },
    });
  }

  return { OR: accessFilters };
}

export function buildMaterialAccessSql(
  context: MaterialAccessContext,
  paramIndexStart: number
): { clause: string | null; params: unknown[]; nextParamIndex: number } {
  if (isPrivilegedMaterialRole(context.role)) {
    return { clause: null, params: [], nextParamIndex: paramIndexStart };
  }

  const params: unknown[] = [];
  const clauses: string[] = [];
  let paramIndex = paramIndexStart;

  clauses.push(`m."uploadedById" = $${paramIndex++}`);
  params.push(context.userId);

  clauses.push(`m."accessLevel" = 'PUBLIC'`);

  if (context.facultyCode) {
    clauses.push(
      `(m."accessLevel" = 'FACULTY_ONLY' AND m."facultyCode" = $${paramIndex++})`
    );
    params.push(context.facultyCode);
  }

  if (context.courseCodes.length > 0) {
    clauses.push(
      `(m."accessLevel" = 'COURSE_STUDENTS' AND m."courseCode" = ANY($${paramIndex++}::text[]))`
    );
    params.push(context.courseCodes);
  }

  return {
    clause: `(${clauses.join(" OR ")})`,
    params,
    nextParamIndex: paramIndex,
  };
}
