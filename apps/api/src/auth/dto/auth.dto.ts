// src/auth/dto/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@university.edu.tr',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'yourPassword',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT Access Token',
  })
  accessToken: string;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    facultyId: string | null;
    facultyName: string | null;
    studentId: string | null;
    staffId: string | null;
    interests: string[];
    avatarUrl: string | null;
  };
}

export class TokenPayloadDto {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

  @ApiProperty({ example: 'user@university.edu.tr', description: 'Email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'yourPassword', description: 'Password (min 6 chars)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({ example: 'S12345', description: 'Student ID (optional)' })
  @IsOptional()
  @IsString()
  studentId?: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'user@university.edu.tr' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit verification code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@university.edu.tr' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
