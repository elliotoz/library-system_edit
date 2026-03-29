import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { BookCopyStatus, ReservationStatus, Role } from "@prisma/client";
import { ReservationsService } from "./reservations.service";
import { createPrismaMock } from "../test-utils/create-prisma-mock";

function createNotificationsMock() {
  return {
    create: jest.fn(),
    notifyReservationCreated: jest.fn(),
    notifyAdminNewReservation: jest.fn(),
    notifyReservationApproved: jest.fn(),
    notifyReservationReady: jest.fn(),
    notifyReservationRejected: jest.fn(),
    notifyBookCollected: jest.fn(),
  };
}

function makeReservation(overrides: Partial<{
  id: string;
  status: ReservationStatus;
  userId: string;
  bookCopyId: string;
}> = {}) {
  return {
    id: overrides.id ?? "res-1",
    status: overrides.status ?? ReservationStatus.PENDING,
    userId: overrides.userId ?? "user-1",
    bookCopyId: overrides.bookCopyId ?? "copy-1",
    user: { id: "user-1", role: Role.STUDENT, name: "User", email: "u@example.com" },
    bookCopy: {
      book: { id: "book-1", title: "Clean Code" },
    },
    branch: { id: "branch-1", name: "Main", code: "MAIN" },
  };
}

describe("ReservationsService", () => {
  // ── create() ──────────────────────────────────────────────────────────────

  it("maps reservation unique-index collisions to ConflictException", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: Role.STUDENT,
      name: "Student",
    });
    prisma.$transaction.mockRejectedValue({ code: "P2002" });
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(
      service.create("user-1", { bookId: "book-1", branchId: "branch-1" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("fails cleanly when a claimed copy is lost to a concurrent request", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: Role.STUDENT,
      name: "Student",
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        reservation: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
        },
        bookCopy: {
          findFirst: jest.fn().mockResolvedValue({
            id: "copy-1",
            bookId: "book-1",
            book: { id: "book-1", title: "Book", authors: ["Author"] },
            branch: { id: "branch-1", name: "Main", code: "MAIN" },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(
      service.create("user-1", { bookId: "book-1", branchId: "branch-1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws when create is called for a missing user", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(
      service.create("missing", { bookId: "book-1", branchId: "branch-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("includes APPROVED reservations in the active count when enforcing the limit", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: Role.STUDENT, // limit = 3
      name: "Student",
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        reservation: {
          // 3 active = limit reached; one of them is APPROVED
          count: jest.fn().mockResolvedValue(3),
          create: jest.fn(),
        },
        bookCopy: {
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
      }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(
      service.create("user-1", { bookId: "book-1", branchId: "branch-1" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Verify the count query included APPROVED in the active statuses
    const txCallback = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    const fakeTx = {
      reservation: { count: jest.fn().mockResolvedValue(3), create: jest.fn() },
      bookCopy: { findFirst: jest.fn(), updateMany: jest.fn() },
    };
    await txCallback(fakeTx).catch(() => {});
    expect(fakeTx.reservation.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({
            in: expect.arrayContaining([
              ReservationStatus.PENDING,
              ReservationStatus.APPROVED,
              ReservationStatus.READY_FOR_PICKUP,
            ]),
          }),
        }),
      }),
    );
  });

  // ── approve() ─────────────────────────────────────────────────────────────

  it("approve() transitions reservation from PENDING to APPROVED", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.PENDING }),
    );
    prisma.reservation.update.mockResolvedValue({
      ...makeReservation({ status: ReservationStatus.APPROVED }),
      pickupDeadline: null,
    });
    const service = new ReservationsService(prisma as any, notifications as any);

    const result = await service.approve("res-1");

    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReservationStatus.APPROVED }),
      }),
    );
    expect(result.status).toBe(ReservationStatus.APPROVED);
  });

  it("approve() does not set pickupDeadline", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.PENDING }),
    );
    prisma.reservation.update.mockResolvedValue({
      ...makeReservation({ status: ReservationStatus.APPROVED }),
      pickupDeadline: null,
    });
    const service = new ReservationsService(prisma as any, notifications as any);

    await service.approve("res-1");

    const updateCall = (prisma.reservation.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("pickupDeadline");
  });

  it("approve() rejects a non-PENDING reservation", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.READY_FOR_PICKUP }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(service.approve("res-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── markReady() ───────────────────────────────────────────────────────────

  it("markReady() transitions reservation from APPROVED to READY_FOR_PICKUP", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue({
      ...makeReservation({ status: ReservationStatus.APPROVED }),
      pickupDeadline: null,
    });
    const pickupDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    prisma.reservation.update.mockResolvedValue({
      ...makeReservation({ status: ReservationStatus.READY_FOR_PICKUP }),
      pickupDeadline,
    });
    const service = new ReservationsService(prisma as any, notifications as any);

    const result = await service.markReady("res-1");

    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReservationStatus.READY_FOR_PICKUP,
          pickupDeadline: expect.any(Date),
        }),
      }),
    );
    expect(result.status).toBe(ReservationStatus.READY_FOR_PICKUP);
    expect(result.pickupDeadline).toBeInstanceOf(Date);
  });

  it("markReady() rejects a non-APPROVED reservation", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.PENDING }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(service.markReady("res-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── reject() ──────────────────────────────────────────────────────────────

  it("rejects only pending, approved, or ready-for-pickup reservations", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.COLLECTED }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(service.reject("res-1", "No longer valid")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("reject() accepts an APPROVED reservation", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.APPROVED }),
    );
    prisma.$transaction.mockResolvedValue([
      { ...makeReservation({ status: ReservationStatus.CANCELLED }), bookCopy: { book: { id: "book-1", title: "Clean Code" } }, branch: { id: "branch-1", name: "Main" } },
    ]);
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(service.reject("res-1", "Stock issue")).resolves.toBeDefined();
  });

  // ── collect() ─────────────────────────────────────────────────────────────

  it("blocks collect when the reservation is no longer ready", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.COLLECTED }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(service.collect("res-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces borrow limits inside the collect transaction", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.reservation.findUnique.mockResolvedValue(
      makeReservation({ status: ReservationStatus.READY_FOR_PICKUP }),
    );
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        reservation: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn(),
        },
        borrowPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            maxActiveBorrows: 5,
            maxBorrowDays: 14,
          }),
        },
        borrow: {
          count: jest.fn().mockResolvedValue(5),
          create: jest.fn(),
        },
        bookCopy: {
          update: jest.fn(),
        },
      }),
    );
    const service = new ReservationsService(prisma as any, notifications as any);

    await expect(service.collect("res-1")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.collect("res-1")).rejects.toThrow("You have reached your borrow limit");
  });
});
