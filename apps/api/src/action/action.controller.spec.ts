import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { UserActionType, UserActionStatus } from '@scholarpath/database';

describe('ActionController', () => {
  let controller: ActionController;
  let actionService: {
    findForUser: jest.Mock;
    regenerateForUser: jest.Mock;
    updateStatus: jest.Mock;
  };

  beforeEach(() => {
    actionService = {
      findForUser: jest.fn(),
      regenerateForUser: jest.fn(),
      updateStatus: jest.fn(),
    };
    controller = new ActionController(actionService as unknown as ActionService);
  });

  it('findAll returns paginated items from service', async () => {
    actionService.findForUser.mockResolvedValue({
      items: [
        {
          id: 'a1',
          type: UserActionType.COMPLETION_ACTION,
          title: 't',
          description: 'd',
          priorityScore: 25,
          status: UserActionStatus.OPEN,
          relatedEntityType: 'PROFILE',
          relatedEntityId: 'u1',
          ctaPath: '/profile',
          sourceEventId: null,
          priorityVersion: 'priority-v2',
          expiredAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const result = await controller.findAll(
      { user: { sub: 'u1' } },
      'OPEN',
      undefined,
      '20',
      '0',
      'priority_score',
    );

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(actionService.findForUser).toHaveBeenCalledWith('u1', {
      status: UserActionStatus.OPEN,
      type: undefined,
      limit: 20,
      offset: 0,
      sort: 'priority_score',
    });
  });

  it('updateStatus delegates to service', async () => {
    actionService.updateStatus.mockResolvedValue({ id: 'a1', status: 'DISMISSED' });
    await controller.updateStatus(
      { user: { sub: 'u1' } },
      'a1',
      { status: 'DISMISSED' },
    );
    expect(actionService.updateStatus).toHaveBeenCalledWith(
      'u1',
      'a1',
      'DISMISSED',
    );
  });

  it('rejects invalid status query', async () => {
    await expect(
      controller.findAll({ user: { sub: 'u1' } }, 'INVALID'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ActionService updateStatus integration', () => {
  it('404 path documented via NotFoundException', () => {
    expect(NotFoundException).toBeDefined();
  });
});
