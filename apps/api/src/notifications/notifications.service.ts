import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationType } from "@prisma/client";

interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  bookId?: string;
  branchId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        bookId: dto.bookId,
        branchId: dto.branchId,
      },
    });
  }

  async createMany(notifications: CreateNotificationDto[]) {
    return this.prisma.notification.createMany({
      data: notifications,
    });
  }

  async findUserNotifications(userId: string, limit?: number) {
    const take = Math.min(limit ?? 20, 100);
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async findUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  async deleteAllRead(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId, read: true },
    });
  }

  // Helper methods for creating specific notification types
  async notifyReservationCreated(
    userId: string,
    bookTitle: string,
    branchName: string,
    bookId?: string,
    branchId?: string
  ) {
    return this.create({
      userId,
      type: NotificationType.RESERVATION_CREATED,
      title: "Reservation Submitted",
      message: `Your reservation for "${bookTitle}" at ${branchName} has been submitted and is pending approval.`,
      bookId,
      branchId,
    });
  }

  async notifyReservationApproved(
    userId: string,
    bookTitle: string,
    branchName: string,
    bookId?: string,
    branchId?: string
  ) {
    return this.create({
      userId,
      type: NotificationType.RESERVATION_APPROVED,
      title: "Reservation Approved!",
      message: `Your reservation for "${bookTitle}" at ${branchName} has been approved. We'll notify you when it's ready for pickup.`,
      bookId,
      branchId,
    });
  }

  async notifyReservationReady(
    userId: string,
    bookTitle: string,
    branchName: string,
    pickupDeadline: Date,
    bookId?: string,
    branchId?: string
  ) {
    const deadlineStr = pickupDeadline.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return this.create({
      userId,
      type: NotificationType.RESERVATION_READY,
      title: "Book Ready for Pickup!",
      message: `"${bookTitle}" is ready for pickup at ${branchName}. Please collect it by ${deadlineStr}.`,
      bookId,
      branchId,
    });
  }

  async notifyReservationRejected(
    userId: string,
    bookTitle: string,
    reason: string,
    bookId?: string
  ) {
    return this.create({
      userId,
      type: NotificationType.RESERVATION_REJECTED,
      title: "Reservation Not Approved",
      message: `Your reservation for "${bookTitle}" was not approved. Reason: ${reason}`,
      bookId,
    });
  }

  async notifyBookCollected(
    userId: string,
    bookTitle: string,
    dueDate: Date,
    bookId?: string
  ) {
    const dueDateStr = dueDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return this.create({
      userId,
      type: NotificationType.BORROW_CREATED,
      title: "Book Borrowed Successfully",
      message: `You've borrowed "${bookTitle}". Please return it by ${dueDateStr}. Enjoy your reading!`,
      bookId,
    });
  }

  async notifyDueSoon(
    userId: string,
    bookTitle: string,
    daysLeft: number,
    bookId?: string
  ) {
    return this.create({
      userId,
      type: NotificationType.BORROW_DUE_SOON,
      title: "Book Due Soon ⏰",
      message: `"${bookTitle}" is due in ${daysLeft} day${daysLeft > 1 ? "s" : ""}. Please return or extend it to avoid late fees.`,
      bookId,
    });
  }

  async notifyOverdue(userId: string, bookTitle: string, bookId?: string) {
    return this.create({
      userId,
      type: NotificationType.BORROW_OVERDUE,
      title: "Book Overdue! ⚠️",
      message: `"${bookTitle}" is overdue. Please return it as soon as possible to avoid additional fees.`,
      bookId,
    });
  }

  // Notify admin of new pending reservation
  async notifyAdminNewReservation(
    adminIds: string[],
    userName: string,
    bookTitle: string,
    branchName: string
  ) {
    const notifications = adminIds.map((adminId) => ({
      userId: adminId,
      type: NotificationType.SYSTEM as NotificationType,
      title: "New Reservation Request",
      message: `${userName} has requested to reserve "${bookTitle}" at ${branchName}.`,
    }));

    return this.createMany(notifications);
  }
}
