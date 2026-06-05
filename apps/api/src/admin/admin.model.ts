import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Role } from '@prisma/client';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SETTINGS_CATEGORIES,
  SettingsCategory,
} from './admin.const.js';

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

// ---------------------------------------------------------------------------
// S-E13-05: Duplicate Account Detection DTOs
// ---------------------------------------------------------------------------

export interface DuplicateAccountEntry {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly reason: string;
  readonly matchedWith: string;
}

export interface DuplicateAccountsResponse {
  readonly duplicates: DuplicateAccountEntry[];
  readonly total: number;
}

// ---------------------------------------------------------------------------
// S-E13-07: Automation Settings DTOs
// ---------------------------------------------------------------------------

export class GetSettingsDto {
  @ApiProperty({
    description: 'Settings category',
    enum: SETTINGS_CATEGORIES,
  })
  @IsString()
  @IsIn([...SETTINGS_CATEGORIES])
  readonly category!: SettingsCategory;
}

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Key-value pairs to update',
    example: { threshold_hours: '24', max_cases: '10' },
  })
  readonly settings!: Record<string, string>;
}

export interface SettingEntry {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly description: string | null;
  readonly updatedAt: Date;
}

export interface SettingsResponse {
  readonly category: string;
  readonly settings: SettingEntry[];
}

// ---------------------------------------------------------------------------
// S-E13-08: Integration Settings DTOs
// ---------------------------------------------------------------------------

export class UpdateIntegrationDto {
  @ApiProperty({ description: 'Value for the integration setting' })
  @IsString()
  @IsNotEmpty()
  readonly value!: string;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @IsOptional()
  @IsString()
  readonly description?: string;
}

export interface IntegrationEntry {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly description: string | null;
  readonly isEncrypted: boolean;
  readonly updatedAt: Date;
}

export interface IntegrationTestResult {
  readonly key: string;
  readonly success: boolean;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// S-E13-09: Weekly Duty Schedule DTOs
// ---------------------------------------------------------------------------

export class GetWeeklyScheduleDto {
  @ApiPropertyOptional({
    description: 'Start date for the weekly view (ISO 8601). Defaults to today.',
  })
  @IsOptional()
  @IsString()
  readonly startDate?: string;
}

export interface WeeklyScheduleDay {
  readonly date: string;
  readonly dayOfWeek: string;
  readonly schedules: DutyScheduleEntry[];
  readonly hasGap: boolean;
}

export interface DutyScheduleEntry {
  readonly id: string;
  readonly userId: string;
  readonly userName: string | null;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly isActive: boolean;
}

export interface WeeklyScheduleResponse {
  readonly startDate: string;
  readonly endDate: string;
  readonly days: WeeklyScheduleDay[];
  readonly totalGaps: number;
  readonly overlaps: ScheduleOverlap[];
}

export interface ScheduleOverlap {
  readonly date: string;
  readonly scheduleA: string;
  readonly scheduleB: string;
  readonly overlapStart: Date;
  readonly overlapEnd: Date;
}

// ---------------------------------------------------------------------------
// S-E13-10: Admin Audit Log DTOs
// ---------------------------------------------------------------------------

export class ListAuditLogDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUuidFormat()
  readonly userId?: string;

  @ApiPropertyOptional({ description: 'Filter by action type' })
  @IsOptional()
  @IsString()
  readonly action?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)' })
  @IsOptional()
  @IsString()
  readonly dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)' })
  @IsOptional()
  @IsString()
  readonly dateTo?: string;

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

export interface AuditLogEntry {
  readonly id: string;
  readonly userId: string | null;
  readonly action: string;
  readonly details: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
}

export interface PaginatedAuditLogResponse {
  readonly data: AuditLogEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}
