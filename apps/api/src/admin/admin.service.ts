import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ScholarshipSource } from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import { CreateScholarshipDto } from './dto/create-scholarship.dto';
import { UpdateScholarshipDto } from './dto/update-scholarship.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllScholarships() {
    return this.prisma.scholarship.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createScholarship(dto: CreateScholarshipDto) {
    return this.prisma.scholarship.create({
      data: {
        title: dto.title,
        description: dto.description,
        eligibilityRules: dto.eligibilityRules as Prisma.InputJsonValue | undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        sourceUrl: dto.sourceUrl,
        tags: dto.tags ?? [],
        source: ScholarshipSource.ADMIN,
      },
    });
  }

  async updateScholarship(id: string, dto: UpdateScholarshipDto) {
    await this.ensureExists(id);
    return this.prisma.scholarship.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        eligibilityRules: dto.eligibilityRules as Prisma.InputJsonValue | undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        sourceUrl: dto.sourceUrl,
        tags: dto.tags,
      },
    });
  }

  async deleteScholarship(id: string) {
    await this.ensureExists(id);
    await this.prisma.scholarship.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const scholarship = await this.prisma.scholarship.findUnique({
      where: { id },
    });
    if (!scholarship) {
      throw new NotFoundException('מלגה לא נמצאה');
    }
  }
}
