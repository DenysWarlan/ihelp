import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BreakGlassLoginDto {
  @ApiProperty({ description: 'Break-glass account password' })
  @IsString()
  @IsNotEmpty()
  readonly password!: string;
}
