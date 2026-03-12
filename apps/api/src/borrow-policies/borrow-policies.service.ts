import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";
import { UpdateBorrowPolicyDto } from "./dto/update-policy.dto";

const VALID_ROLES: Role[] = [Role.STUDENT, Role.INSTRUCTOR, Role.STAFF, Role.ADMIN];

@Injectable()
export class BorrowPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.borrowPolicy.findMany({
      orderBy: { role: "asc" },
    });
  }

  async updateByRole(role: string, dto: UpdateBorrowPolicyDto) {
    if (!VALID_ROLES.includes(role as Role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const policy = await this.prisma.borrowPolicy.findUnique({
      where: { role: role as Role },
    });
    if (!policy) {
      throw new NotFoundException(`No borrow policy found for role: ${role}`);
    }

    return this.prisma.borrowPolicy.update({
      where: { role: role as Role },
      data: {
        ...(dto.maxActiveBorrows !== undefined && { maxActiveBorrows: dto.maxActiveBorrows }),
        ...(dto.maxBorrowDays !== undefined && { maxBorrowDays: dto.maxBorrowDays }),
        ...(dto.maxExtensions !== undefined && { maxExtensions: dto.maxExtensions }),
        ...(dto.extensionDays !== undefined && { extensionDays: dto.extensionDays }),
      },
    });
  }
}
