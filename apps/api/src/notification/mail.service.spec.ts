import { MailService } from './mail.service';

describe('MailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns false when MAIL_ENABLED is not true', async () => {
    process.env.MAIL_ENABLED = 'false';
    const service = new MailService();
    const result = await service.send({
      userId: 'u1',
      to: 'student@test.local',
      subject: 'test',
      text: 'body',
    });
    expect(result).toBe(false);
  });

  it('log provider returns true when MAIL_ENABLED=true', async () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.MAIL_PROVIDER = 'log';
    const service = new MailService();
    service.onModuleInit();
    const result = await service.send({
      userId: 'u1',
      to: 'student@test.local',
      subject: 'מועד אחרון',
      text: 'תוכן',
    });
    expect(result).toBe(true);
  });

  it('MAIL_OVERRIDE_TO redirects recipient in log mode', async () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.MAIL_PROVIDER = 'log';
    process.env.MAIL_OVERRIDE_TO = 'real@gmail.com';
    const service = new MailService();
    const logSpy = jest.spyOn(service['logger'], 'log');
    const result = await service.send({
      userId: 'u1',
      to: 'student@scholarpath.local',
      subject: 'test',
      text: 'body',
    });
    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('r***l@gmail.com'),
    );
    delete process.env.MAIL_OVERRIDE_TO;
  });
});
