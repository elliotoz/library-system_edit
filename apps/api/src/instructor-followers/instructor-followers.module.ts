import { Module } from '@nestjs/common';
import { InstructorFollowersService } from './instructor-followers.service';
import { InstructorFollowersController } from './instructor-followers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InstructorFollowersController],
  providers: [InstructorFollowersService],
  exports: [InstructorFollowersService],
})
export class InstructorFollowersModule {}
