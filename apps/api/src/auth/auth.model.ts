import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StaffLoginDto {
  @ApiProperty({ description: 'Staff email address' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ description: 'Password', minLength: 12 })
  @IsString()
  @MinLength(12)
  readonly password!: string;

  @ApiProperty({ description: 'MFA TOTP code (if MFA is enabled)', required: false })
  @IsOptional()
  @IsString()
  readonly mfaCode?: string;
}

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
  readonly name?: string;
  readonly iat?: number;
  readonly exp?: number;
}

export class PersonLoginDto {
  @ApiProperty({ description: 'Person email address' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ description: 'Password', minLength: 8 })
  @IsString()
  @MinLength(8)
  readonly password!: string;
}

export class SetPasswordDto {
  @ApiProperty({ description: 'New password', minLength: 8 })
  @IsString()
  @MinLength(8)
  readonly password!: string;

  @ApiProperty({ description: 'Current password (required if password already set)', required: false })
  @IsOptional()
  @IsString()
  readonly currentPassword?: string;
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
