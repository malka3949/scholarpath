import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  listPosts() {
    return this.communityService.listPosts();
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  createPost(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreatePostDto,
  ) {
    return this.communityService.createPost(req.user.sub, dto);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.communityService.getPost(id);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @Req() req: { user: { sub: string } },
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.addComment(req.user.sub, postId, dto);
  }
}
