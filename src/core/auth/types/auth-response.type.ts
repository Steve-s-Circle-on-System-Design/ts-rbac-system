export type RegisterResponse = {
  id?: string;
  email: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};
