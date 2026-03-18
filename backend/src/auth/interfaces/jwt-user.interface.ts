import { UserRole } from '../../common/enums/user-role.enum';

export interface JwtUser {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
}
