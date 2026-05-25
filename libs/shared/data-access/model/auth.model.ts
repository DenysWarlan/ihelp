export interface StaffLoginRequest {
  readonly email: string;
  readonly password: string;
  readonly mfaCode?: string;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface MfaChallenge {
  readonly mfaRequired: true;
}

export type StaffLoginResponse = TokenPair | MfaChallenge;

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly avatarUrl: string | null;
}

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
}
