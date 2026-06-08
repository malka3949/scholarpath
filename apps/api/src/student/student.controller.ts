import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { StudentService } from './student.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('student')
@UseGuards(JwtAuthGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('profile')
  getProfile(@Req() req: { user: { sub: string } }) {
    return this.studentService.getProfile(req.user.sub);
  }

  @Put('profile')
  updateProfile(
    @Req() req: { user: { sub: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.studentService.updateProfile(req.user.sub, dto);
  }
}
