// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, AuthResponseDto, TokenPayloadDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        faculty: true,
      },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      throw new BadRequestException('Your account has been deactivated. Please contact the administrator.');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Remove password from response
    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Login user and return JWT token
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Create JWT payload
    const payload: TokenPayloadDto = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate token
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        facultyId: user.facultyId,
        facultyName: user.faculty?.name || null,
        studentId: user.studentId,
        staffId: user.staffId,
        interests: user.interests,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<TokenPayloadDto> {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Get user by ID (for JWT strategy)
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        faculty: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        faculty: {
          include: {
            defaultBranch: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get borrow policy for user's role
    const borrowPolicy = await this.prisma.borrowPolicy.findUnique({
      where: { role: user.role },
    });

    // Get current borrows count
    const activeBorrowsCount = await this.prisma.borrow.count({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      borrowPolicy,
      activeBorrowsCount,
      remainingBorrows: borrowPolicy 
        ? borrowPolicy.maxActiveBorrows - activeBorrowsCount 
        : 0,
    };
  }
}
