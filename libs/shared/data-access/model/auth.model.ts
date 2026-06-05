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

export interface PersonLoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface PhoneLoginRequest {
  readonly phone: string;
  readonly password: string;
}

export interface PersonRegisterRequest {
  readonly name: string;
  readonly password: string;
  readonly email?: string;
  readonly phone?: string;
}

export type PersonLoginResponse = TokenPair;
