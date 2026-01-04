import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BookQueryDto, CreateBookDto, UpdateBookDto } from "./dto/books.dto";
import { BookCopyStatus } from "@prisma/client";

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: BookQueryDto) {
    const {
      search,
      facultyId,
      category,
      availability,
      sortBy = "title",
      sortOrder = "asc",
      page = 1,
      pageSize = 12,
    } = query;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { authors: { hasSome: [search] } },
        { isbn: { contains: search, mode: "insensitive" } },
      ];
    }

    if (facultyId) {
      where.mainFacultyId = facultyId;
    }

    if (category) {
      where.category = category;
    }

    const orderBy: any = {};
    if (sortBy === "author") {
      orderBy.authors = sortOrder;
    } else if (sortBy === "year") {
      orderBy.publicationYear = sortOrder;
    } else {
      orderBy.title = sortOrder;
    }

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        include: {
          mainFaculty: { select: { id: true, name: true, code: true } },
          copies: { select: { id: true, status: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.book.count({ where }),
    ]);

    const booksWithAvailability = books.map((book) => {
      const totalCopies = book.copies.length;
      const availableCopies = book.copies.filter(
        (copy) => copy.status === BookCopyStatus.AVAILABLE
      ).length;
      const { copies, ...bookWithoutCopies } = book;
      return {
        ...bookWithoutCopies,
        totalCopies,
        availableCopies,
        isAvailable: availableCopies > 0,
      };
    });

    return {
      data: booksWithAvailability,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        mainFaculty: { select: { id: true, name: true, code: true } },
        copies: {
          include: {
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    const totalCopies = book.copies.length;
    const availableCopies = book.copies.filter(
      (copy) => copy.status === BookCopyStatus.AVAILABLE
    ).length;

    const copiesByBranch = book.copies.reduce(
      (acc, copy) => {
        const branchId = copy.branch.id;
        if (!acc[branchId]) {
          acc[branchId] = {
            branch: copy.branch,
            total: 0,
            available: 0,
            copies: [],
          };
        }
        acc[branchId].total++;
        if (copy.status === BookCopyStatus.AVAILABLE) {
          acc[branchId].available++;
        }
        acc[branchId].copies.push({
          id: copy.id,
          brandId: copy.brandId,
          status: copy.status,
          condition: copy.condition,
        });
        return acc;
      },
      {} as Record<string, any>
    );

    return {
      ...book,
      copies: undefined,
      totalCopies,
      availableCopies,
      isAvailable: availableCopies > 0,
      availability: Object.values(copiesByBranch),
    };
  }

  async create(dto: CreateBookDto) {
    // Check for duplicate ISBN if provided
    if (dto.isbn) {
      const existingBook = await this.prisma.book.findUnique({
        where: { isbn: dto.isbn },
      });
      if (existingBook) {
        throw new BadRequestException(
          `Book with ISBN ${dto.isbn} already exists`
        );
      }
    }

    // Calculate total copies
    const totalCopies =
      dto.branches?.reduce((sum, b) => sum + b.numberOfCopies, 0) || 0;

    // Must have either physical copies or e-book
    if (totalCopies === 0 && !dto.isEbookAvailable) {
      throw new BadRequestException(
        "At least one physical copy or e-book is required"
      );
    }

    // Validate branches exist only if there are copies
    if (totalCopies > 0) {
      const branchIds = dto.branches
        .filter((b) => b.numberOfCopies > 0)
        .map((b) => b.branchId);
      const branches = await this.prisma.libraryBranch.findMany({
        where: { id: { in: branchIds } },
      });

      if (branches.length !== branchIds.length) {
        throw new BadRequestException("One or more branch IDs are invalid");
      }
    }

    // Create book and copies in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the book
      const book = await tx.book.create({
        data: {
          title: dto.title,
          authors: dto.authors,
          isbn: dto.isbn,
          description: dto.description,
          publisher: dto.publisher,
          publicationYear: dto.publicationYear,
          edition: dto.edition,
          pageCount: dto.pageCount,
          language: dto.language || "English",
          category: dto.category,
          coverImageUrl: dto.coverImageUrl,
          mainFacultyId: dto.mainFacultyId,
          subjectTags: dto.subjectTags || [],
          isEbookAvailable: dto.isEbookAvailable || false,
          ebookUrl: dto.ebookUrl,
          source: "Manual",
          isActive: true,
        },
      });

      // Generate and create book copies (only if there are copies to create)
      if (totalCopies > 0) {
        const copyData: any[] = [];
        let copyCounter = 1;

        for (const branch of dto.branches) {
          if (branch.numberOfCopies > 0) {
            for (let i = 0; i < branch.numberOfCopies; i++) {
              const brandId = `COPY-${book.id.slice(-6).toUpperCase()}-${String(copyCounter).padStart(3, "0")}`;
              copyData.push({
                bookId: book.id,
                branchId: branch.branchId,
                brandId,
                status: BookCopyStatus.AVAILABLE,
                condition: "Good",
                isDemo: false,
              });
              copyCounter++;
            }
          }
        }

        if (copyData.length > 0) {
          await tx.bookCopy.createMany({ data: copyData });
        }
      }

      return book;
    });

    // Return the created book with copies
    return this.findById(result.id);
  }

  async update(id: string, dto: UpdateBookDto) {
    const book = await this.prisma.book.findUnique({ where: { id } });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    // Check for duplicate ISBN if changing ISBN
    if (dto.isbn && dto.isbn !== book.isbn) {
      const existingBook = await this.prisma.book.findUnique({
        where: { isbn: dto.isbn },
      });
      if (existingBook) {
        throw new BadRequestException(
          `Book with ISBN ${dto.isbn} already exists`
        );
      }
    }

    const updated = await this.prisma.book.update({
      where: { id },
      data: {
        title: dto.title,
        authors: dto.authors,
        isbn: dto.isbn,
        description: dto.description,
        publisher: dto.publisher,
        publicationYear: dto.publicationYear,
        edition: dto.edition,
        pageCount: dto.pageCount,
        language: dto.language,
        category: dto.category,
        coverImageUrl: dto.coverImageUrl,
        mainFacultyId: dto.mainFacultyId,
        subjectTags: dto.subjectTags,
        isEbookAvailable: dto.isEbookAvailable,
        ebookUrl: dto.ebookUrl,
        isActive: dto.isActive,
      },
      include: {
        mainFaculty: { select: { id: true, name: true, code: true } },
      },
    });

    return updated;
  }

  async delete(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        copies: {
          where: {
            status: { in: [BookCopyStatus.BORROWED, BookCopyStatus.RESERVED] },
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    // Check if any copies are borrowed or reserved
    if (book.copies.length > 0) {
      throw new BadRequestException(
        "Cannot delete book with borrowed or reserved copies. Please wait for all copies to be returned."
      );
    }

    // Soft delete - just mark as inactive
    await this.prisma.book.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: "Book deleted successfully" };
  }

  async addCopies(bookId: string, branchId: string, numberOfCopies: number) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(`Book with ID ${bookId} not found`);
    }

    const branch = await this.prisma.libraryBranch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    // Get current max copy number
    const existingCopies = await this.prisma.bookCopy.count({
      where: { bookId },
    });

    const copyData: any[] = [];
    for (let i = 0; i < numberOfCopies; i++) {
      const copyNumber = existingCopies + i + 1;
      const brandId = `COPY-${book.id.slice(-6).toUpperCase()}-${String(copyNumber).padStart(3, "0")}`;
      copyData.push({
        bookId,
        branchId,
        brandId,
        status: BookCopyStatus.AVAILABLE,
        condition: "Good",
        isDemo: false,
      });
    }

    await this.prisma.bookCopy.createMany({ data: copyData });

    return this.findById(bookId);
  }

  async getCategories() {
    const categories = await this.prisma.book.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });
    return categories
      .map((c) => c.category)
      .filter((c) => c !== null)
      .sort();
  }

  async getFacultiesWithBookCount() {
    const faculties = await this.prisma.faculty.findMany({
      include: {
        _count: { select: { books: { where: { isActive: true } } } },
      },
    });
    return faculties.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      bookCount: f._count.books,
    }));
  }

  async getBranches() {
    return this.prisma.libraryBranch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, address: true },
      orderBy: { name: "asc" },
    });
  }
}
