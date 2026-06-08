import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateMotivationLetterDto } from './dto/update-motivation-letter.dto';
import { GenerateMotivationLetterDto } from './dto/generate-motivation-letter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Get()
  findAll(@Req() req: { user: { sub: string } }) {
    return this.applicationService.findAllForUser(req.user.sub);
  }

  @Get(':id')
  findOne(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.applicationService.findOne(req.user.sub, id);
  }

  @Post()
  create(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationService.create(req.user.sub, dto);
  }

  @Post('start/:scholarshipId')
  startWorkflow(
    @Req() req: { user: { sub: string } },
    @Param('scholarshipId') scholarshipId: string,
  ) {
    return this.applicationService.findOrCreate(req.user.sub, scholarshipId);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationService.updateStatus(req.user.sub, id, dto);
  }

  @Patch(':id/letter')
  updateLetter(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: UpdateMotivationLetterDto,
  ) {
    return this.applicationService.updateMotivationLetter(
      req.user.sub,
      id,
      dto,
    );
  }

  @Post(':id/generate-letter')
  generateLetter(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: GenerateMotivationLetterDto,
  ) {
    return this.applicationService.generateMotivationLetter(
      req.user.sub,
      id,
      dto,
    );
  }
}
