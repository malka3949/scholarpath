import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('פרופיל לא נמצא');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotificationsEnabled: true },
    });
    if (!user) {
      throw new NotFoundException('משתמש לא נמצא');
    }
    return {
      ...profile,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.emailNotificationsEnabled !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailNotificationsEnabled: dto.emailNotificationsEnabled },
      });
    }

    const profile = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: {
        fieldOfStudy: dto.fieldOfStudy,
        year: dto.year,
        gpa: dto.gpa,
        preferences: dto.preferences as Prisma.InputJsonValue | undefined,
      },
      create: {
        userId,
        fieldOfStudy: dto.fieldOfStudy,
        year: dto.year,
        gpa: dto.gpa,
        preferences: dto.preferences as Prisma.InputJsonValue | undefined,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotificationsEnabled: true },
    });

    return {
      ...profile,
      emailNotificationsEnabled: user?.emailNotificationsEnabled ?? true,
    };
  }

  isProfileComplete(profile: {
    fieldOfStudy: string | null;
    year: number | null;
    gpa: number | null;
  }) {
    return Boolean(profile.fieldOfStudy && profile.year && profile.gpa);
  }
}
