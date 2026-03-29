import { NotFoundException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { createPrismaMock } from "../test-utils/create-prisma-mock";

describe("UsersService", () => {
  it("uses an explicit safe select for findAll", async () => {
    const prisma = createPrismaMock();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
    const service = new UsersService(prisma as any);

    await service.findAll();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
          faculty: true,
        }),
      }),
    );

    const select = prisma.user.findMany.mock.calls[0][0].select;
    expect(select.password).toBeUndefined();
    expect(select.emailVerificationToken).toBeUndefined();
    expect(select.emailVerificationExpiry).toBeUndefined();
    expect(select.passwordResetToken).toBeUndefined();
    expect(select.passwordResetExpiry).toBeUndefined();
  });

  it("uses an explicit safe select for findById", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "STUDENT",
      authProvider: "LOCAL",
      emailVerifiedAt: new Date(),
      studentId: null,
      staffId: null,
      facultyId: null,
      interests: [],
      bio: null,
      department: null,
      courses: [],
      avatarUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      faculty: null,
    });
    const service = new UsersService(prisma as any);

    await service.findById("user-1");

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          email: true,
          faculty: expect.any(Object),
        }),
      }),
    );

    const select = prisma.user.findUnique.mock.calls[0][0].select;
    expect(select.password).toBeUndefined();
    expect(select.emailVerificationToken).toBeUndefined();
    expect(select.passwordResetToken).toBeUndefined();
  });

  it("throws NotFoundException when findById misses", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new UsersService(prisma as any);

    await expect(service.findById("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
