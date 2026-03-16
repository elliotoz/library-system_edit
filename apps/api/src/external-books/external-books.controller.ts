import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExternalBooksService } from './external-books.service';
import { ImportBookDto } from './dto/external-books.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('external-books')
@Controller('external-books')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExternalBooksController {
  constructor(private readonly service: ExternalBooksService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search Open Library and Gutendex for books' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  async search(@Query('q') q: string) {
    return this.service.search(q);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Import a single external book into the catalog (admin only)' })
  async importBook(@Body() dto: ImportBookDto) {
    return this.service.importBook(dto);
  }

  @Post('import/gutendex')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Bulk import first 100 Gutendex books into the catalog (admin only)' })
  async bulkImportGutendex() {
    return this.service.bulkImportGutendex();
  }
}
