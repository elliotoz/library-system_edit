import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { UsersController } from "./users.controller";

function createUsersServiceMock() {
  return {
    findById: jest.fn().mockResolvedValue({ id: "user-1", name: "Test" }),
  };
}

function createStorageServiceMock() {
  return { uploadImage: jest.fn() };
}

describe("UsersController.findById", () => {
  it("allows ADMIN to fetch any user record", async () => {
    const usersService = createUsersServiceMock();
    const controller = new UsersController(
      usersService as any,
      createStorageServiceMock() as any,
    );

    const result = await controller.findById("other-user-99", {
      id: "admin-1",
      role: Role.ADMIN,
    });

    expect(usersService.findById).toHaveBeenCalledWith("other-user-99");
    expect(result).toEqual({ id: "user-1", name: "Test" });
  });

  it("allows a user to fetch their own record", async () => {
    const usersService = createUsersServiceMock();
    const controller = new UsersController(
      usersService as any,
      createStorageServiceMock() as any,
    );

    const result = await controller.findById("user-1", {
      id: "user-1",
      role: Role.STUDENT,
    });

    expect(usersService.findById).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ id: "user-1", name: "Test" });
  });

  it("throws ForbiddenException when a non-admin requests another user's record", async () => {
    const usersService = createUsersServiceMock();
    const controller = new UsersController(
      usersService as any,
      createStorageServiceMock() as any,
    );

    await expect(
      controller.findById("other-user-99", {
        id: "user-1",
        role: Role.STUDENT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException for INSTRUCTOR requesting another user's record", async () => {
    const usersService = createUsersServiceMock();
    const controller = new UsersController(
      usersService as any,
      createStorageServiceMock() as any,
    );

    await expect(
      controller.findById("other-user-99", {
        id: "instructor-1",
        role: Role.INSTRUCTOR,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.findById).not.toHaveBeenCalled();
  });
});
