export interface OAuthProfile {
  readonly provider: string;
  readonly providerId: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
  readonly iat?: number;
  readonly exp?: number;
}

export interface RefreshTokenDto {
  readonly refreshToken: string;
}

export interface ProviderLinkResponse {
  readonly id: string;
  readonly provider: string;
  readonly providerAccountId: string;
  readonly createdAt: Date;
}
