import { BorrowStatus, BookCopyStatus, NotificationType, ReservationStatus } from "@prisma/client";
import { BorrowSchedulerService } from "./borrow-scheduler.service";
import { createPrismaMock } from "../test-utils/create-prisma-mock";

function createNotificationsMock() {
  return {
    create: jest.fn(),
    notifyDueSoon: jest.fn(),
  };
}

describe("BorrowSchedulerService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("transitions active overdue borrows to OVERDUE", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.borrow.updateMany.mockResolvedValue({ count: 2 });
    prisma.reservation.findMany.mockResolvedValue([]);
    prisma.borrow.findMany.mockResolvedValue([]);
    const service = new BorrowSchedulerService(prisma as any, notifications as any);

    await service.runChecks();

    expect(prisma.borrow.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: BorrowStatus.ACTIVE }),
        data: { status: BorrowStatus.OVERDUE },
      }),
    );
  });

  it("expires stale reservations and frees reserved copies", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    prisma.borrow.updateMany.mockResolvedValue({ count: 0 });
    prisma.reservation.updateMany = jest.fn().mockResolvedValue({ count: 1 }) as any;
    prisma.bookCopy.updateMany = jest.fn().mockResolvedValue({ count: 1 }) as any;
    // First findMany call: PENDING/APPROVED by expiresAt
    // Second findMany call: READY_FOR_PICKUP by pickupDeadline
    // Third findMany call: overdue borrows for notifications
    prisma.reservation.findMany
      .mockResolvedValueOnce([
        {
          id: "res-1",
          userId: "user-1",
          bookCopyId: "copy-1",
          status: ReservationStatus.PENDING,
          bookCopy: {
            book: {
              id: "book-1",
              title: "Distributed Systems",
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.borrow.findMany.mockResolvedValue([]);
    const service = new BorrowSchedulerService(prisma as any, notifications as any);

    await service.runChecks();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "res-1",
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED, ReservationStatus.READY_FOR_PICKUP] },
      },
      data: { status: ReservationStatus.EXPIRED },
    });
    expect(prisma.bookCopy.updateMany).toHaveBeenCalledWith({
      where: { id: "copy-1", status: BookCopyStatus.RESERVED },
      data: { status: BookCopyStatus.AVAILABLE },
    });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: NotificationType.RESERVATION_EXPIRED,
      }),
    );
  });
});
