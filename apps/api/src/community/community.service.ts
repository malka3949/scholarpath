import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  private authorName(user: { name: string | null; email: string }) {
    return user.name?.trim() || user.email;
  }

  async listPosts() {
    const posts = await this.prisma.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { comments: true } },
      },
    });

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      createdAt: p.createdAt,
      authorName: this.authorName(p.user),
      commentCount: p._count.comments,
    }));
  }

  async getPost(id: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('פוסט לא נמצא');
    }

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt,
      authorName: this.authorName(post.user),
      comments: post.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        authorName: this.authorName(c.user),
        parentId: c.parentId,
      })),
    };
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.communityPost.create({
      data: {
        userId,
        title: dto.title,
        body: dto.body,
      },
      include: { user: { select: { name: true, email: true } } },
    });

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt,
      authorName: this.authorName(post.user),
      commentCount: 0,
    };
  }

  async addComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('פוסט לא נמצא');
    }

    if (dto.parentId) {
      const parent = await this.prisma.communityComment.findFirst({
        where: { id: dto.parentId, postId },
      });
      if (!parent) {
        throw new BadRequestException('תגובת האב לא נמצאה בפוסט זה');
      }
    }

    const comment = await this.prisma.communityComment.create({
      data: {
        userId,
        postId,
        body: dto.body,
        parentId: dto.parentId ?? null,
      },
      include: { user: { select: { name: true, email: true } } },
    });

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorName: this.authorName(comment.user),
      parentId: comment.parentId,
    };
  }
}
