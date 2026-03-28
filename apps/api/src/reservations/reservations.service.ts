import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationStatus, BookCopyStatus, Role } from "@prisma/client";
import { CreateReservationDto } from "./dto/reservations.dto";
import { NotificationsService } from "../notifications/notifications.service";

// Reservation limits by role
const RESERVATION_LIMITS: Record<Role, number> = {
  STUDENT: 3,
  INSTRUCTOR: 5,
  STAFF: 3,
  ADMIN: 10,
};

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService
  ) {}

  async findMyReservations(userId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: { userId },
      include: {
        bookCopy: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
          },
        },
        branch: { select: { id: true, name: true, code: true, address: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return reservations.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      pickupDeadline: r.pickupDeadline,
      book: r.bookCopy.book,
      branch: r.branch,
    }));
  }

  async findAllReservations(query: {
    status?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;

    const [reservations, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          bookCopy: {
            include: {
              book: { select: { id: true, title: true, authors: true } },
            },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return {
      data: reservations.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        pickupDeadline: r.pickupDeadline,
        user: r.user,
        book: r.bookCopy.book,
        branch: r.branch,
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findPendingReservations() {
    const reservations = await this.prisma.reservation.findMany({
      where: { status: ReservationStatus.PENDING },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        bookCopy: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return reservations.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      user: r.user,
      book: r.bookCopy.book,
      branch: r.branch,
    }));
  }

  async create(userId: string, dto: CreateReservationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    let result: {
      id: string;
      status: ReservationStatus;
      createdAt: Date;
      expiresAt: Date | null;
      book: { id: string; title: string; authors: string[] };
      branch: { id: string; name: string; code: string };
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Reservation limit check is inside the transaction so it is consistent
        // with concurrent creates for the same user.
        const activeReservations = await tx.reservation.count({
          where: {
            userId,
            status: {
              in: [ReservationStatus.PENDING, ReservationStatus.READY_FOR_PICKUP],
            },
          },
        });

        const limit = RESERVATION_LIMITS[user.role];
        if (activeReservations >= limit) {
          throw new BadRequestException(
            `You have reached your reservation limit (${limit}). Please cancel or collect existing reservations first.`
          );
        }

        // Find one available copy — the partial unique index on (userId, bookId)
        // enforces the per-book uniqueness constraint at DB level, so no
        // application-level duplicate check is needed here.
        const availableCopy = await tx.bookCopy.findFirst({
          where: {
            bookId: dto.bookId,
            branchId: dto.branchId,
            status: BookCopyStatus.AVAILABLE,
          },
          include: {
            book: { select: { id: true, title: true, authors: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        });

        if (!availableCopy) {
          throw new BadRequestException(
            "No available copies at the selected branch"
          );
        }

        // Claim the copy atomically. If a concurrent request already took it
        // the count will be 0 and we surface a clean error.
        const claimed = await tx.bookCopy.updateMany({
          where: { id: availableCopy.id, status: BookCopyStatus.AVAILABLE },
          data: { status: BookCopyStatus.RESERVED },
        });

        if (claimed.count === 0) {
          throw new BadRequestException(
            "No available copies at the selected branch"
          );
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // bookId is server-derived from the selected copy — never from client input.
        const reservation = await tx.reservation.create({
          data: {
            userId,
            bookCopyId: availableCopy.id,
            bookId: availableCopy.bookId,
            branchId: dto.branchId,
            status: ReservationStatus.PENDING,
            expiresAt,
          },
        });

        return {
          id: reservation.id,
          status: reservation.status,
          createdAt: reservation.createdAt,
          expiresAt: reservation.expiresAt,
          book: availableCopy.book,
          branch: availableCopy.branch,
        };
      });
    } catch (err: any) {
      // Partial unique index violation — user already has an active reservation
      // for this book (caught here to give a human-readable 409).
      if (err?.code === 'P2002') {
        throw new BadRequestException(
          "You already have an active reservation for this book"
        );
      }
      throw err;
    }

    await this.notificationsService.notifyReservationCreated(
      userId,
      result.book.title,
      result.branch.name,
      result.book.id,
      result.branch.id
    );

    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    if (admins.length > 0 && user.name) {
      await this.notificationsService.notifyAdminNewReservation(
        admins.map((a) => a.id),
        user.name,
        result.book.title,
        result.branch.name
      );
    }

    return result;
  }

  async cancel(reservationId: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { bookCopy: true },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException("You can only cancel your own reservations");
    }

    if (reservation.status === ReservationStatus.COLLECTED) {
      throw new BadRequestException("Cannot cancel a collected reservation");
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException("Reservation is already cancelled");
    }

    const [updatedReservation] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELLED },
        include: {
          bookCopy: { include: { book: true } },
          branch: true,
        },
      }),
      this.prisma.bookCopy.update({
        where: { id: reservation.bookCopyId },
        data: { status: BookCopyStatus.AVAILABLE },
      }),
    ]);

    return {
      id: updatedReservation.id,
      status: updatedReservation.status,
      book: updatedReservation.bookCopy.book,
      branch: updatedReservation.branch,
    };
  }

  async approve(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { bookCopy: true },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException("Can only approve pending reservations");
    }

    const pickupDeadline = new Date();
    pickupDeadline.setDate(pickupDeadline.getDate() + 2);

    const updatedReservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.READY_FOR_PICKUP,
        pickupDeadline,
      },
      include: {
        bookCopy: { include: { book: true } },
        branch: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await this.notificationsService.notifyReservationApproved(
      updatedReservation.user.id,
      updatedReservation.bookCopy.book.title,
      updatedReservation.branch.name,
      pickupDeadline,
      updatedReservation.bookCopy.book.id,
      updatedReservation.branch.id
    );

    return {
      id: updatedReservation.id,
      status: updatedReservation.status,
      pickupDeadline: updatedReservation.pickupDeadline,
      book: updatedReservation.bookCopy.book,
      branch: updatedReservation.branch,
      user: updatedReservation.user,
    };
  }

  async reject(reservationId: string, reason: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        bookCopy: { include: { book: { select: { id: true, title: true } } } },
        branch: true,
        user: { select: { id: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.READY_FOR_PICKUP
    ) {
      throw new BadRequestException(
        "Only pending or ready-for-pickup reservations can be rejected"
      );
    }

    const [updatedReservation] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CANCELLED,
          notes: `Rejected: ${reason}`,
        },
        include: {
          bookCopy: { include: { book: true } },
          branch: true,
        },
      }),
      this.prisma.bookCopy.update({
        where: { id: reservation.bookCopyId },
        data: { status: BookCopyStatus.AVAILABLE },
      }),
    ]);

    await this.notificationsService.notifyReservationRejected(
      reservation.user.id,
      reservation.bookCopy.book.title,
      reason,
      reservation.bookCopy.book.id
    );

    return {
      id: updatedReservation.id,
      status: updatedReservation.status,
      book: updatedReservation.bookCopy.book,
      branch: updatedReservation.branch,
    };
  }

  async getStats() {
    const [pending, ready, collected, cancelled, expired] = await Promise.all([
      this.prisma.reservation.count({
        where: { status: ReservationStatus.PENDING },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.READY_FOR_PICKUP },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.COLLECTED },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.CANCELLED },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.EXPIRED },
      }),
    ]);

    return {
      pending,
      ready,
      collected,
      cancelled,
      expired,
      total: pending + ready + collected + cancelled + expired,
    };
  }

  async getUserReservationInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const activeCount = await this.prisma.reservation.count({
      where: {
        userId,
        status: {
          in: [ReservationStatus.PENDING, ReservationStatus.READY_FOR_PICKUP],
        },
      },
    });

    const limit = RESERVATION_LIMITS[user.role];

    return {
      activeReservations: activeCount,
      reservationLimit: limit,
      remainingReservations: limit - activeCount,
      canReserve: activeCount < limit,
    };
  }

  async collect(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        bookCopy: { include: { book: true } },
        branch: true,
        user: { select: { id: true, role: true, name: true, email: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.status !== ReservationStatus.READY_FOR_PICKUP) {
      throw new BadRequestException(
        "Reservation is no longer ready for pickup"
      );
    }

    const { updatedReservation, borrow } = await this.prisma.$transaction(async (tx) => {
      // Serialize all concurrent collect calls for this user so that the
      // borrow-limit check and borrow insert are atomic for that user.
      // This is the only borrow-creation path for reserved-copy collection.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservation.user.id}))`;

      // Atomically transition the reservation. If count is 0 a concurrent
      // request already collected or the state changed — surface a clean error.
      const transitioned = await tx.reservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.READY_FOR_PICKUP },
        data: { status: ReservationStatus.COLLECTED },
      });

      if (transitioned.count === 0) {
        throw new BadRequestException("Reservation is no longer ready for pickup");
      }

      // Fetch borrow policy and enforce the limit inside the locked transaction.
      const borrowPolicy = await tx.borrowPolicy.findUnique({
        where: { role: reservation.user.role },
      });

      const maxBorrows = borrowPolicy?.maxActiveBorrows ?? 5;
      const borrowDays = borrowPolicy?.maxBorrowDays ?? 14;

      const activeBorrowCount = await tx.borrow.count({
        where: { userId: reservation.user.id, status: "ACTIVE" },
      });

      if (activeBorrowCount >= maxBorrows) {
        throw new BadRequestException("You have reached your borrow limit");
      }

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + borrowDays);

      const borrow = await tx.borrow.create({
        data: {
          userId: reservation.user.id,
          bookCopyId: reservation.bookCopyId,
          borrowedAt: new Date(),
          dueAt,
          status: "ACTIVE",
        },
        include: {
          bookCopy: { include: { book: true } },
        },
      });

      await tx.bookCopy.update({
        where: { id: reservation.bookCopyId },
        data: { status: BookCopyStatus.BORROWED },
      });

      const updatedReservation = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: {
          bookCopy: { include: { book: true } },
          branch: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return { updatedReservation, borrow };
    });

    await this.notificationsService.notifyBookCollected(
      updatedReservation.user.id,
      updatedReservation.bookCopy.book.title,
      borrow.dueAt,
      updatedReservation.bookCopy.book.id
    );

    return {
      reservation: {
        id: updatedReservation.id,
        status: updatedReservation.status,
        book: updatedReservation.bookCopy.book,
        branch: updatedReservation.branch,
        user: updatedReservation.user,
      },
      borrow: {
        id: borrow.id,
        borrowedAt: borrow.borrowedAt,
        dueAt: borrow.dueAt,
        book: borrow.bookCopy.book,
      },
    };
  }

  async findReadyForPickup() {
    const reservations = await this.prisma.reservation.findMany({
      where: { status: ReservationStatus.READY_FOR_PICKUP },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        bookCopy: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { pickupDeadline: "asc" },
      take: 100,
    });

    return reservations.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      pickupDeadline: r.pickupDeadline,
      user: r.user,
      book: r.bookCopy.book,
      branch: r.branch,
    }));
  }
}
