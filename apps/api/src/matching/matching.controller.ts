import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  getRecommendations(@Req() req: { user: { sub: string } }) {
    return this.matchingService.getRecommendations(req.user.sub);
  }

  @Post('refresh')
  refreshRecommendations(@Req() req: { user: { sub: string } }) {
    return this.matchingService.refreshRecommendations(req.user.sub);
  }
}
