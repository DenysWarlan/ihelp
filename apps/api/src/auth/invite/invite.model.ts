import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

import { MIN_PASSWORD_LENGTH } from './invite.const.js';

export class CreateInviteDto {
  @ApiProperty({ description: 'Email address of the invitee' })
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @ApiProperty({ description: 'Role to assign to the invitee', enum: Role })
  @IsEnum(Role)
  @IsNotEmpty()
  readonly role!: Role;
}

export class ClaimInviteDto {
  @ApiProperty({ description: 'Invite token received via email' })
  @IsString()
  @IsNotEmpty()
  readonly token!: string;

  @ApiProperty({ description: 'Display name of the new user' })
  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @ApiProperty({ description: 'Password for the new staff account', minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  readonly password!: string;
}
