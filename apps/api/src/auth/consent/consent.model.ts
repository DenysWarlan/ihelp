import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ConsentDto {
  @ApiProperty({
    description: 'Type of consent to grant',
    enum: ['data', 'sensitive'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['data', 'sensitive'])
  readonly type!: 'data' | 'sensitive';
}

export interface ConsentStatus {
  readonly dataConsentAt: Date | null;
  readonly sensitiveDataConsentAt: Date | null;
  readonly hasRequiredConsent: boolean;
}
