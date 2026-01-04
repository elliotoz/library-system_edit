import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get my notifications" })
  async getMyNotifications(
    @CurrentUser("id") userId: string,
    @Query("limit") limit?: string
  ) {
    const notifications = await this.notificationsService.findUserNotifications(
      userId,
      limit ? parseInt(limit) : 20
    );
    const unreadCount = await this.notificationsService.findUnreadCount(userId);

    return {
      notifications,
      unreadCount,
    };
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get unread notification count" })
  async getUnreadCount(@CurrentUser("id") userId: string) {
    const count = await this.notificationsService.findUnreadCount(userId);
    return { unreadCount: count };
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark notification as read" })
  async markAsRead(@Param("id") id: string, @CurrentUser("id") userId: string) {
    await this.notificationsService.markAsRead(id, userId);
    return { success: true };
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  async markAllAsRead(@CurrentUser("id") userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a notification" })
  async deleteNotification(
    @Param("id") id: string,
    @CurrentUser("id") userId: string
  ) {
    await this.notificationsService.deleteNotification(id, userId);
    return { success: true };
  }

  @Delete("clear-read")
  @ApiOperation({ summary: "Delete all read notifications" })
  async clearRead(@CurrentUser("id") userId: string) {
    await this.notificationsService.deleteAllRead(userId);
    return { success: true };
  }
}
