import { ForbiddenException } from '@nestjs/common';
import { JwtUser } from '../../auth/interfaces/jwt-user.interface';
import { UserRole } from '../enums/user-role.enum';

export function assertMaster(currentUser: JwtUser, resourceName: string) {
  if (currentUser.role !== UserRole.MASTER) {
    throw new ForbiddenException(
      `${resourceName} 작업은 MASTER 계정만 수행할 수 있습니다.`,
    );
  }
}
