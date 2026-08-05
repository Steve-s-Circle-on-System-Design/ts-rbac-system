export type RegisterResponse = {
  id: string;
  email: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};
export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
}
