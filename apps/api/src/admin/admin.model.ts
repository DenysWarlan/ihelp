import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Role } from '@prisma/client';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './admin.const.js';

// ---------------------------------------------------------------------------
// Staff user CRUD DTOs (S-E13-01)
// ---------------------------------------------------------------------------

export class CreateStaffUserDto {
  @ApiProperty({ description: 'Email address of the new staff user' })
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @ApiProperty({ description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @ApiProperty({ description: 'Role to assign', enum: Role })
  @IsEnum(Role)
  @IsNotEmpty()
  readonly role!: Role;
}

export class UpdateStaffUserDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  readonly name?: string;

  @ApiPropertyOptional({ description: 'Role to assign', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  readonly role?: Role;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}

export class ListStaffUsersDto {
  @ApiPropertyOptional({ description: 'Filter by role', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  readonly role?: Role;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  readonly isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  readonly pageSize?: number;
}

export interface StaffUserResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PaginatedStaffUsersResponse {
  readonly data: StaffUserResponse[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

// ---------------------------------------------------------------------------
// Invite management DTOs (S-E13-02)
// ---------------------------------------------------------------------------

export class CreateAdminInviteDto {
  @ApiProperty({ description: 'Email address of the invitee' })
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @ApiProperty({ description: 'Role to assign to the invitee', enum: Role })
  @IsEnum(Role)
  @IsNotEmpty()
  readonly role!: Role;
}

export class ListInvitesDto {
  @ApiPropertyOptional({ description: 'Filter by status: pending, claimed, expired' })
  @IsOptional()
  @IsString()
  readonly status?: 'pending' | 'claimed' | 'expired';

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  readonly pageSize?: number;
}

export interface InviteResponse {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: 'pending' | 'claimed' | 'expired';
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly claimedAt: Date | null;
}

export interface PaginatedInvitesResponse {
  readonly data: InviteResponse[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}
