import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@scholarpath/database';
import { PrismaService } from '../prisma/prisma.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('כתובת האימייל כבר רשומה במערכת');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        role: Role.STUDENT,
        profile: { create: {} },
      },
      include: { profile: true },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים');
    }

    return this.buildAuthResponse(user);
  }

  async googleAuth(dto: GoogleAuthDto) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: dto.googleId }, { email: dto.email.toLowerCase() }],
      },
      include: { profile: true },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: dto.googleId,
          name: dto.name ?? user.name,
        },
        include: { profile: true },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          googleId: dto.googleId,
          role: Role.STUDENT,
          profile: { create: {} },
        },
        include: { profile: true },
      });
    }

    return this.buildAuthResponse(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new UnauthorizedException('משתמש לא נמצא');
    }
    return this.sanitizeUser(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    profile?: unknown;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    profile?: unknown;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profile: user.profile ?? null,
    };
  }
}
