import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { UserActionStatus, UserActionType } from '@scholarpath/database';
import { ActionService } from './action.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateActionStatusDto } from './dto/update-action-status.dto';
import { ActionListQuery, UserActionListResponse } from './action.types';

const REGENERATE_COOLDOWN_MS = 60_000;
const regenerateTimestamps = new Map<string, number>();

const VALID_STATUSES = [
  UserActionStatus.OPEN,
  UserActionStatus.DONE,
  UserActionStatus.DISMISSED,
  UserActionStatus.EXPIRED,
];

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Get()
  async findAll(
    @Req() req: { user: { sub: string } },
    @Query('status') statusParam?: string,
    @Query('type') typeParam?: string,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
    @Query('sort') sortParam?: string,
  ): Promise<UserActionListResponse> {
    const query: ActionListQuery = {
      status: this.parseStatus(statusParam),
      type: this.parseType(typeParam),
      limit: this.parseLimit(limitParam, 20, 50),
      offset: this.parseOffset(offsetParam),
      sort: sortParam === 'createdAt' ? 'createdAt' : 'priority_score',
    };

    return this.actionService.findForUser(req.user.sub, query);
  }

  @Post('regenerate')
  async regenerate(
    @Req() req: { user: { sub: string } },
    @Query('limit') limitParam?: string,
  ): Promise<UserActionListResponse> {
    const userId = req.user.sub;
    const now = Date.now();
    const last = regenerateTimestamps.get(userId) ?? 0;
    if (now - last < REGENERATE_COOLDOWN_MS) {
      throw new HttpException(
        'ניתן לרענן פעולות פעם בדקה',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    regenerateTimestamps.set(userId, now);

    const limit = this.parseLimit(limitParam, 5, 50);
    const items = await this.actionService.regenerateForUser(userId, limit);
    return {
      items,
      total: items.length,
      limit,
      offset: 0,
    };
  }

  @Patch(':id')
  updateStatus(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: UpdateActionStatusDto,
  ) {
    return this.actionService.updateStatus(req.user.sub, id, dto.status);
  }

  private parseStatus(value?: string): UserActionStatus {
    if (!value) return UserActionStatus.OPEN;
    if (!VALID_STATUSES.includes(value as UserActionStatus)) {
      throw new BadRequestException('סטטוס פעולה לא תקין');
    }
    return value as UserActionStatus;
  }

  private parseType(value?: string): UserActionType | undefined {
    if (!value) return undefined;
    if (!Object.values(UserActionType).includes(value as UserActionType)) {
      throw new BadRequestException('סוג פעולה לא תקין');
    }
    return value as UserActionType;
  }

  private parseLimit(
    limitParam: string | undefined,
    defaultValue: number,
    max: number,
  ): number {
    const parsed = limitParam ? parseInt(limitParam, 10) : defaultValue;
    if (Number.isNaN(parsed) || parsed < 1) return defaultValue;
    return Math.min(parsed, max);
  }

  private parseOffset(offsetParam?: string): number {
    const parsed = offsetParam ? parseInt(offsetParam, 10) : 0;
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return parsed;
  }
}
