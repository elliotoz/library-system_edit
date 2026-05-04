import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { BookQueryDto, CreateBookDto, UpdateBookDto } from "./dto/books.dto";
import { BookCopyStatus, IndexStatus } from "@prisma/client";
import { BookDocumentService } from "./book-document.service";

const DEFAULT_PDF_BACKFILL_LIMIT = 25;
const MAX_PDF_BACKFILL_LIMIT = 200;

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private bookDocumentService: BookDocumentService,
  ) {}

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

    if (availability === "available") {
      where.copies = { some: { status: BookCopyStatus.AVAILABLE } };
    } else if (availability === "ebook-only") {
      where.isEbookAvailable = true;
      where.copies = { none: {} };
    } else if (availability === "unavailable") {
      where.AND = [
        { copies: { some: {} } },
        { NOT: { copies: { some: { status: BookCopyStatus.AVAILABLE } } } },
      ];
    }

    const orderBy: any = {};
    if (sortBy === "author") {
      orderBy.createdAt = sortOrder;
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
        isEbookAvailable: book.isEbookAvailable,
        ebookUrl: book.ebookUrl,
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

    const totalCopies =
      dto.branches?.reduce((sum, b) => sum + b.numberOfCopies, 0) || 0;

    if (totalCopies === 0 && !dto.isEbookAvailable) {
      throw new BadRequestException(
        "At least one physical copy or e-book is required"
      );
    }

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

    const result = await this.prisma.$transaction(async (tx) => {
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
          pdfIndexStatus: IndexStatus.NOT_APPLICABLE,
        },
      });

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

    return this.findById(result.id);
  }

  async update(id: string, dto: UpdateBookDto) {
    const book = await this.prisma.book.findUnique({ where: { id } });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

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

    if (book.copies.length > 0) {
      throw new BadRequestException(
        "Cannot delete book with borrowed or reserved copies. Please wait for all copies to be returned."
      );
    }

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
      });
    }

    await this.prisma.bookCopy.createMany({ data: copyData });

    return this.findById(bookId);
  }

  async queuePendingPdfIndexing(limitInput?: string | number) {
    const parsedLimit =
      typeof limitInput === "number" ? limitInput : Number(limitInput);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), MAX_PDF_BACKFILL_LIMIT)
      : DEFAULT_PDF_BACKFILL_LIMIT;

    const pendingBooks = await this.prisma.book.findMany({
      where: {
        pdfUrl: { not: null },
        pdfIndexStatus: IndexStatus.PENDING,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });

    for (const book of pendingBooks) {
      this.bookDocumentService.indexBookPdf(book.id).catch((error) => {
        this.logger.error(
          `Queued PDF indexing failed for ${book.id} (${book.title}): ${String(error)}`
        );
      });
    }

    return {
      queued: pendingBooks.length,
      limit,
      bookIds: pendingBooks.map((book) => book.id),
    };
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

  async uploadPdf(
    bookId: string,
    file: Express.Multer.File,
  ): Promise<{ pdfUrl: string }> {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new NotFoundException(`Book ${bookId} not found`);

    const pdfUrl = await this.storage.uploadFile(file, "pdfs");

    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        pdfUrl,
        pdfExtractedText: null,
        pdfIndexStatus: IndexStatus.PENDING,
        pdfIndexedAt: null,
        pdfPageCount: null,
      },
    });

    this.bookDocumentService.indexBookPdf(bookId).catch(() => undefined);

    return { pdfUrl };
  }
}
