import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { PrismaService } from '../prisma/prisma.module';

describe('CommunityService', () => {
  let service: CommunityService;
  let prisma: {
    communityPost: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    communityComment: { create: jest.Mock; findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      communityPost: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      communityComment: { create: jest.fn(), findFirst: jest.fn() },
    };
    service = new CommunityService(prisma as unknown as PrismaService);
  });

  it('creates post with author name', async () => {
    const createdAt = new Date();
    prisma.communityPost.create.mockResolvedValue({
      id: 'p1',
      title: 'שאלה',
      body: 'תוכן מפורט של השאלה',
      createdAt,
      user: { name: 'סטודנט', email: 's@test.com' },
    });

    const post = await service.createPost('u1', {
      title: 'שאלה',
      body: 'תוכן מפורט של השאלה',
    });

    expect(post.id).toBe('p1');
    expect(post.authorName).toBe('סטודנט');
    expect(post.commentCount).toBe(0);
  });

  it('adds comment to existing post', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.communityComment.create.mockResolvedValue({
      id: 'c1',
      body: 'תשובה',
      createdAt: new Date(),
      parentId: null,
      user: { name: null, email: 'a@test.com' },
    });

    const comment = await service.addComment('u2', 'p1', { body: 'תשובה' });

    expect(comment.authorName).toBe('a@test.com');
    expect(prisma.communityComment.create).toHaveBeenCalled();
  });

  it('adds reply when parent belongs to post', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.communityComment.findFirst.mockResolvedValue({ id: 'c1', postId: 'p1' });
    prisma.communityComment.create.mockResolvedValue({
      id: 'c2',
      body: 'תשובה לתשובה',
      createdAt: new Date(),
      parentId: 'c1',
      user: { name: 'ב', email: 'b@test.com' },
    });

    const comment = await service.addComment('u3', 'p1', {
      body: 'תשובה לתשובה',
      parentId: 'c1',
    });

    expect(comment.parentId).toBe('c1');
    expect(prisma.communityComment.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', postId: 'p1' },
    });
  });

  it('rejects reply when parent missing from post', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.communityComment.findFirst.mockResolvedValue(null);

    await expect(
      service.addComment('u3', 'p1', { body: 'x', parentId: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when post missing for comment', async () => {
    prisma.communityPost.findUnique.mockResolvedValue(null);
    await expect(
      service.addComment('u2', 'missing', { body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
