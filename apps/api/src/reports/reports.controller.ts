import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService, ReportSummary } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async getSummary(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const { fromDate, toDate } = this.parseDates(from, to);
    return this.reportsService.getSummary(fromDate, toDate);
  }

  @Get('export')
  async exportReport(
    @Query('format') format: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    if (!format || !['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('Format must be "pdf" or "excel"');
    }

    const { fromDate, toDate } = this.parseDates(from, to);
    const summary = await this.reportsService.getSummary(fromDate, toDate);

    if (format === 'pdf') {
      return this.exportPdf(summary, res);
    }
    return this.exportExcel(summary, res);
  }

  private parseDates(from: string, to: string) {
    if (!from || !to) {
      throw new BadRequestException('Both "from" and "to" query parameters are required');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }
    return { fromDate, toDate };
  }

  private exportPdf(summary: ReportSummary, res: Response) {
    const filename = `library-report-${summary.period.from}-to-${summary.period.to}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Library System Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#666')
      .text(`Period: ${summary.period.from} to ${summary.period.to}`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary metrics
    doc.fontSize(14).fillColor('#000').text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    const metrics = [
      ['Total Borrows', summary.totalBorrows],
      ['Total Returns', summary.totalReturns],
      ['Currently Overdue', summary.overdueCount],
      ['Pending Reservations', summary.pendingReservations],
      ['Collected Fines', `₺${summary.collectedFines.toFixed(2)}`],
    ];

    for (const [label, value] of metrics) {
      doc.text(`${label}: ${value}`);
    }
    doc.moveDown(1);

    // Top Books
    if (summary.topBooks.length > 0) {
      doc.fontSize(14).text('Top Borrowed Books', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      summary.topBooks.forEach((book, i) => {
        doc.text(`${i + 1}. ${book.title} by ${book.author} — ${book.borrowCount} borrows`);
      });
      doc.moveDown(1);
    }

    // Users by Role
    if (summary.usersByRole.length > 0) {
      doc.fontSize(14).text('Active Users by Role', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      summary.usersByRole.forEach((u) => {
        doc.text(`${u.role}: ${u.count}`);
      });
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#999')
      .text(`Generated on ${new Date().toISOString().split('T')[0]}`, { align: 'center' });

    doc.end();
  }

  private async exportExcel(summary: ReportSummary, res: Response) {
    const filename = `library-report-${summary.period.from}-to-${summary.period.to}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    summarySheet.addRow({ metric: 'Period', value: `${summary.period.from} to ${summary.period.to}` });
    summarySheet.addRow({ metric: 'Total Borrows', value: summary.totalBorrows });
    summarySheet.addRow({ metric: 'Total Returns', value: summary.totalReturns });
    summarySheet.addRow({ metric: 'Currently Overdue', value: summary.overdueCount });
    summarySheet.addRow({ metric: 'Pending Reservations', value: summary.pendingReservations });
    summarySheet.addRow({ metric: 'Collected Fines (₺)', value: summary.collectedFines });

    // Top Books sheet
    const booksSheet = workbook.addWorksheet('Top Books');
    booksSheet.columns = [
      { header: '#', key: 'rank', width: 5 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Author', key: 'author', width: 30 },
      { header: 'Borrows', key: 'borrowCount', width: 12 },
    ];
    booksSheet.getRow(1).font = { bold: true };

    summary.topBooks.forEach((book, i) => {
      booksSheet.addRow({ rank: i + 1, ...book });
    });

    // Users sheet
    const usersSheet = workbook.addWorksheet('Users by Role');
    usersSheet.columns = [
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Count', key: 'count', width: 12 },
    ];
    usersSheet.getRow(1).font = { bold: true };

    summary.usersByRole.forEach((u) => {
      usersSheet.addRow(u);
    });

    await workbook.xlsx.write(res);
    res.end();
  }
}
