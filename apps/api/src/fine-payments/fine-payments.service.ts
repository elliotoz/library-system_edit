import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FineStatus } from '@prisma/client';

@Injectable()
export class FinePaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    status?: FineStatus;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, userId, page = 1, pageSize = 20 } = params;
    const take = Math.min(pageSize, 100);
    const skip = (page - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [fines, total] = await Promise.all([
      this.prisma.finePayment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          borrow: {
            include: {
              bookCopy: { include: { book: { select: { id: true, title: true } } } },
            },
          },
          paidBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.finePayment.count({ where }),
    ]);

    return { fines, total, page, pageSize: take };
  }

  async findById(id: string) {
    const fine = await this.prisma.finePayment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        borrow: {
          include: {
            bookCopy: { include: { book: { select: { id: true, title: true } } } },
          },
        },
        paidBy: { select: { id: true, name: true } },
      },
    });

    if (!fine) throw new NotFoundException('Fine payment not found');
    return fine;
  }

  async markPaid(id: string, adminId: string) {
    const fine = await this.prisma.finePayment.findUnique({ where: { id } });
    if (!fine) throw new NotFoundException('Fine payment not found');
    if (fine.status !== FineStatus.PENDING) {
      throw new BadRequestException(`Fine is already ${fine.status.toLowerCase()}`);
    }

    return this.prisma.finePayment.update({
      where: { id },
      data: {
        status: FineStatus.PAID,
        paidAt: new Date(),
        paidById: adminId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });
  }

  async waive(id: string, adminId: string, note?: string) {
    const fine = await this.prisma.finePayment.findUnique({ where: { id } });
    if (!fine) throw new NotFoundException('Fine payment not found');
    if (fine.status !== FineStatus.PENDING) {
      throw new BadRequestException(`Fine is already ${fine.status.toLowerCase()}`);
    }

    return this.prisma.finePayment.update({
      where: { id },
      data: {
        status: FineStatus.WAIVED,
        paidAt: new Date(),
        paidById: adminId,
        note: note || 'Waived by admin',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });
  }

  async getTotals() {
    const [pending, paid, waived] = await Promise.all([
      this.prisma.finePayment.aggregate({
        where: { status: FineStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.finePayment.aggregate({
        where: { status: FineStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.finePayment.aggregate({
        where: { status: FineStatus.WAIVED },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      pending: { count: pending._count, total: Number(pending._sum.amount || 0) },
      paid: { count: paid._count, total: Number(paid._sum.amount || 0) },
      waived: { count: waived._count, total: Number(waived._sum.amount || 0) },
    };
  }
}
