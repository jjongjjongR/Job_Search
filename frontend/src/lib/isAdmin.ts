// src/lib/isAdmin.ts

export const ADMIN_IMAGE_URL =
  "http://k.kakaocdn.net/dn/lwFqn/btsNdmPkWSR/EtKLxPPp3muViNI6oKg1F1/img_640x640.jpg";

export function isAdmin(session: any): boolean {
  return session?.user?.image === ADMIN_IMAGE_URL;
}
