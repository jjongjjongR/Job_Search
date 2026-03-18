import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
  username: z.string().min(1, 'username은 비워둘 수 없습니다.'),
  displayName: z.string().min(1, 'displayName은 비워둘 수 없습니다.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
