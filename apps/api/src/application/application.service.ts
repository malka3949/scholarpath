import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApplicationStatus } from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import { ClaudeService } from '../ai/claude.service';
import { ProfileSummarizerService } from '../ai/profile-summarizer.service';
import { StudentService } from '../student/student.service';
import { canTransition } from './application-state.machine';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateMotivationLetterDto } from './dto/update-motivation-letter.dto';
import { GenerateMotivationLetterDto } from './dto/generate-motivation-letter.dto';
import { NotificationService } from '../notification/notification.service';
import { EventsService } from '../events/events.service';
import { ActionService } from '../action/action.service';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly profileSummarizer: ProfileSummarizerService,
    private readonly studentService: StudentService,
    private readonly notificationService: NotificationService,
    private readonly eventsService: EventsService,
    private readonly actionService: ActionService,
  ) {}

  async findAllForUser(userId: string) {
    return this.prisma.application.findMany({
      where: { userId },
      include: { scholarship: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: { scholarship: true },
    });
    if (!application) {
      throw new NotFoundException('בקשה לא נמצאה');
    }
    return application;
  }

  async create(userId: string, dto: CreateApplicationDto) {
    const scholarship = await this.prisma.scholarship.findUnique({
      where: { id: dto.scholarshipId },
    });
    if (!scholarship) {
      throw new NotFoundException('מלגה לא נמצאה');
    }

    const existing = await this.prisma.application.findUnique({
      where: {
        userId_scholarshipId: {
          userId,
          scholarshipId: dto.scholarshipId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('כבר קיימת בקשה למלגה זו');
    }

    if (!this.isDeadlineOpen(scholarship.deadline)) {
      throw new BadRequestException('המועד האחרון להגשת בקשה למלגה זו עבר');
    }

    const application = await this.prisma.application.create({
      data: {
        userId,
        scholarshipId: dto.scholarshipId,
        status: ApplicationStatus.NOT_STARTED,
      },
      include: { scholarship: true },
    });

    await this.eventsService.recordApplyStartSafe(userId, dto.scholarshipId);

    this.actionService.scheduleRegenerate(userId);

    return application;
  }

  async findOrCreate(userId: string, scholarshipId: string) {
    const existing = await this.prisma.application.findUnique({
      where: { userId_scholarshipId: { userId, scholarshipId } },
      include: { scholarship: true },
    });
    if (existing) return existing;
    return this.create(userId, { scholarshipId });
  }

  async updateStatus(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.findOne(userId, applicationId);

    if (!canTransition(application.status, dto.status)) {
      throw new BadRequestException(
        `לא ניתן לעבור מסטטוס "${application.status}" ל-"${dto.status}"`,
      );
    }

    if (
      dto.status === ApplicationStatus.SUBMITTED &&
      !application.motivationLetter?.trim()
    ) {
      throw new BadRequestException(
        'יש לשמור מכתב מוטיבציה לפני סימון כהוגש',
      );
    }

    if (
      dto.status === ApplicationStatus.SUBMITTED &&
      !this.isDeadlineOpen(application.scholarship.deadline)
    ) {
      throw new BadRequestException('המועד האחרון להגשת בקשה למלגה זו עבר');
    }

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: dto.status },
      include: { scholarship: true },
    });

    if (dto.status === ApplicationStatus.SUBMITTED) {
      await this.notificationService.createApplicationStatusNotification(
        updated,
      );
    }

    this.actionService.scheduleRegenerate(userId);

    return updated;
  }

  async updateMotivationLetter(
    userId: string,
    applicationId: string,
    dto: UpdateMotivationLetterDto,
  ) {
    const application = await this.findOne(userId, applicationId);
    const status = this.resolveStatusAfterLetterEdit(
      application.status,
      dto.motivationLetter,
    );

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        motivationLetter: dto.motivationLetter,
        status,
      },
      include: { scholarship: true },
    });

    this.actionService.scheduleRegenerate(userId);

    return updated;
  }

  async generateMotivationLetter(
    userId: string,
    applicationId: string,
    dto: GenerateMotivationLetterDto,
  ) {
    const application = await this.findOne(userId, applicationId);

    const [profile, user] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!profile || !this.studentService.isProfileComplete(profile)) {
      throw new BadRequestException(
        'יש להשלים פרופיל (תחום, שנה, ממוצע) לפני יצירת מכתב',
      );
    }

    const profileSummary = this.profileSummarizer.summarize(profile);
    const { letter, source } = await this.claude.generateMotivationLetter({
      profileSummary,
      studentName: user?.name ?? null,
      scholarshipTitle: application.scholarship.title,
      scholarshipDescription: application.scholarship.description,
      notes: dto.notes,
    });

    const status =
      application.status === ApplicationStatus.NOT_STARTED
        ? ApplicationStatus.IN_PROGRESS
        : application.status;

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { motivationLetter: letter, status },
      include: { scholarship: true },
    });

    this.actionService.scheduleRegenerate(userId);

    return { application: updated, source };
  }

  private resolveStatusAfterLetterEdit(
    current: ApplicationStatus,
    letter: string,
  ): ApplicationStatus {
    if (
      current === ApplicationStatus.NOT_STARTED &&
      letter.trim().length > 0
    ) {
      return ApplicationStatus.IN_PROGRESS;
    }
    return current;
  }

  private isDeadlineOpen(deadline: Date | null): boolean {
    if (!deadline) return true;
    return deadline.getTime() > Date.now();
  }
}
