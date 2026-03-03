// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, AuthResponseDto, TokenPayloadDto, RegisterDto, VerifyEmailDto, ResendVerificationDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';

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

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      throw new BadRequestException('Please verify your email address before logging in.');
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
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return String(randomInt(100000, 999999));
  }

  /**
   * Register a new user with email/password
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationCode = this.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          name: dto.name,
          studentId: dto.studentId || undefined,
          authProvider: 'LOCAL',
          emailVerificationToken: verificationCode,
          emailVerificationExpiry: verificationExpiry,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    // TODO: Send verification email with code (Slice 2/3)
    // For now, log the code in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Verification code for ${user.email}: ${verificationCode}`);
    }

    return {
      message: 'Registration successful. Please check your email for the verification code.',
      email: user.email,
    };
  }

  /**
   * Verify email with 6-digit code
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('No account found with this email');
    }

    if (user.emailVerifiedAt) {
      return { message: 'Email is already verified' };
    }

    if (
      user.emailVerificationToken !== dto.code ||
      !user.emailVerificationExpiry ||
      user.emailVerificationExpiry < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  /**
   * Resend verification code
   */
  async resendVerification(dto: ResendVerificationDto) {
    const genericMessage = 'If an account exists with this email, a new verification code has been sent.';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Don't reveal whether email exists or is already verified
    if (!user || user.emailVerifiedAt) {
      return { message: genericMessage };
    }

    // Rate limit: code expiry is 15min from send time, so sentAt = expiry - 15min
    if (user.emailVerificationExpiry) {
      const sentAt = user.emailVerificationExpiry.getTime() - 15 * 60 * 1000;
      if (Date.now() - sentAt < 60 * 1000) {
        throw new BadRequestException('Please wait at least 60 seconds before requesting a new code');
      }
    }

    const verificationCode = this.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationCode,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // TODO: Send verification email (Slice 2/3)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] New verification code for ${user.email}: ${verificationCode}`);
    }

    return { message: genericMessage };
  }

  /**
   * Find or create a user from Google OAuth profile
   */
  async findOrCreateGoogleUser(email: string, name: string, avatarUrl: string | null) {
    const normalizedEmail = email.toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { faculty: true },
    });

    if (user) {
      // Link existing LOCAL account to Google if not already
      if (user.authProvider === 'LOCAL') {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            authProvider: 'GOOGLE',
            emailVerifiedAt: user.emailVerifiedAt || new Date(),
            emailVerificationToken: null,
            emailVerificationExpiry: null,
            avatarUrl: user.avatarUrl || avatarUrl,
          },
          include: { faculty: true },
        });
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    } else {
      // Create new Google user
      const placeholderPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          password: placeholderPassword,
          name,
          authProvider: 'GOOGLE',
          emailVerifiedAt: new Date(),
          avatarUrl,
        },
        include: { faculty: true },
      });
    }

    if (!user.isActive) {
      throw new BadRequestException('Your account has been deactivated. Please contact the administrator.');
    }

    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Generate JWT token and return auth response for a user (used by Google OAuth callback)
   */
  generateTokenForUser(user: any): AuthResponseDto {
    const payload: TokenPayloadDto = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

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
   * Request password reset — always returns generic message
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const genericMessage = 'If an account exists with this email, a password reset link has been sent.';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.emailVerifiedAt || user.authProvider !== 'LOCAL') {
      return { message: genericMessage };
    }

    // Rate limit: don't regenerate if token was sent less than 60s ago
    if (user.passwordResetExpiry) {
      const sentAt = user.passwordResetExpiry.getTime() - 60 * 60 * 1000;
      if (Date.now() - sentAt < 60 * 1000) {
        return { message: genericMessage };
      }
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: resetExpiry,
      },
    });

    // TODO: Send email with reset link
    if (process.env.NODE_ENV !== 'production') {
      const frontendUrl = this.configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
      console.log(`[DEV] Password reset link for ${user.email}: ${frontendUrl}/reset-password?token=${resetToken}`);
    }

    return { message: genericMessage };
  }

  /**
   * Reset password with token
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return { message: 'Password reset successfully. You can now log in with your new password.' };
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
