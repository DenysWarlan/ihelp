import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MfaTokenDto {
  @ApiProperty({ description: 'TOTP token from authenticator app' })
  @IsString()
  @IsNotEmpty()
  readonly token!: string;
}

export interface MfaSetupResponse {
  readonly secret: string;
  readonly qrCodeUrl: string;
}

export interface MfaEnableResponse {
  readonly backupCodes: readonly string[];
}
