import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SearchScholarshipsDto } from './dto/search-scholarships.dto';

@Injectable()
export class ScholarshipService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SearchScholarshipsDto) {
    const where: Record<string, unknown> = {};

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { tags: { has: query.q } },
      ];
    }

    if (query.tag) {
      where.tags = { has: query.tag };
    }

    return this.prisma.scholarship.findMany({
      where,
      orderBy: [{ deadline: 'asc' }, { title: 'asc' }],
    });
  }

  async findOne(id: string) {
    const scholarship = await this.prisma.scholarship.findUnique({
      where: { id },
    });
    if (!scholarship) {
      throw new NotFoundException('מלגה לא נמצאה');
    }
    return scholarship;
  }
}
