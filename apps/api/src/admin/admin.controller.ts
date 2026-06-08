import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateScholarshipDto } from './dto/create-scholarship.dto';
import { UpdateScholarshipDto } from './dto/update-scholarship.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/scholarships')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll() {
    return this.adminService.findAllScholarships();
  }

  @Post()
  create(@Body() dto: CreateScholarshipDto) {
    return this.adminService.createScholarship(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScholarshipDto) {
    return this.adminService.updateScholarship(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminService.deleteScholarship(id);
  }
}
