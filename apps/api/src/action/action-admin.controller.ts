import {
  Controller,
  Post,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ActionService } from './action.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.module';
import { UserActionListResponse } from './action.types';

@Controller('admin/actions')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ActionAdminController {
  constructor(
    private readonly actionService: ActionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('regenerate/:userId')
  async regenerateForUser(
    @Param('userId') userId: string,
  ): Promise<UserActionListResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('משתמש לא נמצא');
    }
    const items = await this.actionService.regenerateForUser(userId, 5);
    return { items, total: items.length, limit: 5, offset: 0 };
  }
}
