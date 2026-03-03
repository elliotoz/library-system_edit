import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InstructorFollowersService } from './instructor-followers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('instructor-followers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('instructor-followers')
export class InstructorFollowersController {
  constructor(private readonly service: InstructorFollowersService) {}

  @Get('my-following')
  @ApiOperation({ summary: 'Get instructors I follow' })
  @ApiResponse({ status: 200, description: 'List of followed instructors' })
  async getMyFollowing(@CurrentUser('id') userId: string) {
    return this.service.getMyFollowing(userId);
  }

  @Post(':instructorId/follow')
  @ApiOperation({ summary: 'Follow an instructor' })
  @ApiResponse({ status: 201, description: 'Followed successfully' })
  async follow(
    @CurrentUser('id') userId: string,
    @Param('instructorId') instructorId: string,
  ) {
    return this.service.follow(userId, instructorId);
  }

  @Delete(':instructorId/unfollow')
  @ApiOperation({ summary: 'Unfollow an instructor' })
  @ApiResponse({ status: 200, description: 'Unfollowed successfully' })
  async unfollow(
    @CurrentUser('id') userId: string,
    @Param('instructorId') instructorId: string,
  ) {
    return this.service.unfollow(userId, instructorId);
  }

  @Get(':instructorId/followers-count')
  @ApiOperation({ summary: 'Get follower count for an instructor' })
  @ApiResponse({ status: 200, description: 'Follower count' })
  async getFollowersCount(@Param('instructorId') instructorId: string) {
    return this.service.getFollowersCount(instructorId);
  }

  @Get(':instructorId/is-following')
  @ApiOperation({ summary: 'Check if current user follows an instructor' })
  @ApiResponse({ status: 200, description: 'Following status' })
  async isFollowing(
    @CurrentUser('id') userId: string,
    @Param('instructorId') instructorId: string,
  ) {
    return this.service.isFollowing(userId, instructorId);
  }
}
