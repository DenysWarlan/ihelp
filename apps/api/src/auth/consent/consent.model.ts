import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class GrantConsentDto {
  @ApiProperty({
    description: 'Type of consent to grant',
    enum: ['data', 'sensitive'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['data', 'sensitive'])
  readonly type!: 'data' | 'sensitive';
}

/** @deprecated Use GrantConsentDto instead */
export class ConsentDto extends GrantConsentDto {}

export interface ConsentStatus {
  readonly dataConsentAt: Date | null;
  readonly sensitiveDataConsentAt: Date | null;
  readonly hasRequiredConsent: boolean;
}

export interface ConsentRecord {
  readonly id: string;
  readonly userId: string;
  readonly consentType: string;
  readonly grantedAt: Date;
  readonly withdrawnAt: Date | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}
