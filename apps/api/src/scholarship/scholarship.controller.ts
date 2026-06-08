import { Controller, Get, Param, Query } from '@nestjs/common';
import { ScholarshipService } from './scholarship.service';
import { SearchScholarshipsDto } from './dto/search-scholarships.dto';

@Controller('scholarships')
export class ScholarshipController {
  constructor(private readonly scholarshipService: ScholarshipService) {}

  @Get()
  findAll(@Query() query: SearchScholarshipsDto) {
    return this.scholarshipService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scholarshipService.findOne(id);
  }
}
