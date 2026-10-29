import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ACCOUNT_TYPES } from '@rfda/shared';

export class LoginDto {
  @IsString() @IsNotEmpty() @MaxLength(200) identifier: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password: string;
}

export class RegisterDto {
  @IsIn(ACCOUNT_TYPES) accountType: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(50) tin?: string;
  @IsEmail() @MaxLength(200) email: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsString() @MinLength(10, { message: 'Use a password of at least 10 characters' }) @MaxLength(200) password: string;
}
