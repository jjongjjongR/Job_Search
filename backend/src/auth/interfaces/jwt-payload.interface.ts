import { UserRole } from '../../common/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
}
