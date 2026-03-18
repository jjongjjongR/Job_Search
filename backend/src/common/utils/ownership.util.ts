import { ForbiddenException } from '@nestjs/common';
import { JwtUser } from '../../auth/interfaces/jwt-user.interface';
import { UserRole } from '../enums/user-role.enum';

export function assertOwnerOrMaster(
  currentUser: JwtUser,
  ownerDisplayName: string,
  resourceName: string,
) {
  if (
    currentUser.role === UserRole.MASTER ||
    currentUser.displayName === ownerDisplayName
  ) {
    return;
  }

  throw new ForbiddenException(`${resourceName}에 대한 권한이 없습니다.`);
}
