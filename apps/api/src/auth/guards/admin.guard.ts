import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@scholarpath/database';
import { JwtPayload } from '../auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (request.user?.role !== Role.ADMIN) {
      throw new ForbiddenException('גישה למנהלים בלבד');
    }
    return true;
  }
}
