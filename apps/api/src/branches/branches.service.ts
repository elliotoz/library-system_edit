import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBranchDto, UpdateBranchDto } from "./dto/branches.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.libraryBranch.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { bookCopies: true, reservations: true },
        },
      },
    });
  }

  async create(dto: CreateBranchDto) {
    try {
      return await this.prisma.libraryBranch.create({
        data: {
          name: dto.name,
          code: dto.code,
          address: dto.address,
          openingHours: dto.openingHours,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new ConflictException(
          `A branch with code "${dto.code}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.libraryBranch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    try {
      return await this.prisma.libraryBranch.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.openingHours !== undefined && {
            openingHours: dto.openingHours,
          }),
          ...(dto.contactEmail !== undefined && {
            contactEmail: dto.contactEmail,
          }),
          ...(dto.contactPhone !== undefined && {
            contactPhone: dto.contactPhone,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new ConflictException(
          `A branch with code "${dto.code}" already exists`,
        );
      }
      throw error;
    }
  }

  async activate(id: string) {
    const branch = await this.prisma.libraryBranch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return this.prisma.libraryBranch.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string) {
    const branch = await this.prisma.libraryBranch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return this.prisma.libraryBranch.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
