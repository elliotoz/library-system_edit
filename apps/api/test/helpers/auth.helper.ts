import * as request from "supertest";
import { INestApplication } from "@nestjs/common";

// Known seed credentials (from prisma/seed.ts — password is "password123" for all)
export const USERS = {
  admin: { email: "admin@uskudar.edu.tr", password: "password123" },
  student: { email: "efe.demir@std.uskudar.edu.tr", password: "password123" },
  instructor: {
    email: "kemal.sahin@uskudar.edu.tr",
    password: "password123",
  },
  staff: { email: "ayse.yildiz@uskudar.edu.tr", password: "password123" },
} as const;

export type UserRole = keyof typeof USERS;

interface LoginResult {
  cookie: string;
  userId: string;
  role: string;
}

const tokenCache = new Map<string, LoginResult>();

export async function loginAs(
  app: INestApplication,
  role: UserRole
): Promise<LoginResult> {
  const cached = tokenCache.get(role);
  if (cached) return cached;

  const creds = USERS[role];
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: creds.email, password: creds.password })
    .expect(200);

  const setCookie = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  // Extract just the access_token=... part for reuse
  const cookie = cookieHeader.split(";")[0];

  const result: LoginResult = {
    cookie,
    userId: res.body.user.id,
    role: res.body.user.role,
  };

  tokenCache.set(role, result);
  return result;
}

export function clearAuthCache(): void {
  tokenCache.clear();
}
