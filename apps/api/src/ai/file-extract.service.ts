import { Injectable, BadRequestException } from '@nestjs/common';

const MAX_WORDS = 80_000;
const HEAD_WORDS = 60_000;
const TAIL_WORDS = 5_000;

export interface ExtractResult {
  text: string;
  wordCount: number;
  totalWordCount: number;
  truncated: boolean;
}

@Injectable()
export class FileExtractService {
  async extractText(buffer: Buffer, mimetype: string, originalname: string): Promise<ExtractResult> {
    const ext = originalname.split('.').pop()?.toLowerCase();

    let raw: string;

    if (mimetype === 'text/plain' || ext === 'txt') {
      raw = buffer.toString('utf-8');
    } else if (mimetype === 'application/pdf' || ext === 'pdf') {
      raw = await this.extractPdf(buffer);
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      raw = await this.extractDocx(buffer);
    } else {
      throw new BadRequestException('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
    }

    return this.truncate(raw.trim());
  }

  private truncate(text: string): ExtractResult {
    const words = text.split(/\s+/).filter(Boolean);
    const totalWordCount = words.length;

    if (totalWordCount <= MAX_WORDS) {
      return { text, wordCount: totalWordCount, totalWordCount, truncated: false };
    }

    const head = words.slice(0, HEAD_WORDS).join(' ');
    const tail = words.slice(-TAIL_WORDS).join(' ');
    const truncated = `${head}\n\n[... content truncated to fit AI context limit (${MAX_WORDS.toLocaleString()} / ${totalWordCount.toLocaleString()} words shown) ...]\n\n${tail}`;
    const wordCount = HEAD_WORDS + TAIL_WORDS;

    return { text: truncated, wordCount, totalWordCount, truncated: true };
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    try {
      // pdf-parse uses DOMMatrix internally for some PDFs — polyfill for Node.js
      if (typeof (globalThis as Record<string, unknown>).DOMMatrix === 'undefined') {
        (globalThis as Record<string, unknown>).DOMMatrix = class {};
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
      const result = await pdfParse(buffer);
      if (!result.text || result.text.trim().length === 0) {
        throw new BadRequestException(
          'This PDF appears to be scanned or image-based and contains no extractable text. ' +
          'Please use a text-based PDF or copy the content into a TXT file.',
        );
      }
      return result.text;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('password') || msg.includes('encrypt')) {
        throw new BadRequestException(
          'This PDF is password-protected. Please remove the password and try again.',
        );
      }
      throw new BadRequestException(
        `Could not read this PDF file. It may be corrupted or use an unsupported format. (${msg})`,
      );
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth') as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || result.value.trim().length === 0) {
        throw new BadRequestException(
          'This DOCX file appears to be empty or contains no readable text.',
        );
      }
      return result.value;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `Could not read this DOCX file. It may be corrupted or use an unsupported format. (${msg})`,
      );
    }
  }
}
