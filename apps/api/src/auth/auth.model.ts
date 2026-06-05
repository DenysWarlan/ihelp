import { IsEmail, IsString, MinLength, MaxLength, IsOptional, ValidateIf, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ description: 'Password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password!: string;
}

export class PersonRegisterDto {
  @ApiProperty({ description: 'Full name' })
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  readonly name!: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  readonly email?: string;

  @ApiPropertyOptional({ description: 'Phone number (e.g. +380501234567)' })
  @ValidateIf((o) => !o.email)
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Phone must be a valid international number' })
  readonly phone?: string;

  @ApiProperty({ description: 'Password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password!: string;
}

export class PhoneLoginDto {
  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Phone must be a valid international number' })
  readonly phone!: string;

  @ApiProperty({ description: 'Password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password!: string;
}

export class SetPasswordDto {
  @ApiProperty({ description: 'New password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password!: string;

  @ApiProperty({ description: 'Current password (required if password already set)', required: false })
  @IsOptional()
  @IsString()
  readonly currentPassword?: string;
}

export class RefreshTokenDto {
  @IsString()
  readonly refreshToken!: string;
}

export interface ProviderLinkResponse {
  readonly id: string;
  readonly provider: string;
  readonly providerAccountId: string;
  readonly createdAt: Date;
}
