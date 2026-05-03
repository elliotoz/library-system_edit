import { Module } from "@nestjs/common";
import { MaterialsService } from "./materials.service";
import { MaterialsController } from "./materials.controller";
import { MaterialIndexerService } from "./material-indexer.service";
import { MaterialSearchService } from "./material-search.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MulterModule } from "@nestjs/platform-express";

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      dest: "./uploads/materials",
    }),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialIndexerService, MaterialSearchService],
  exports: [MaterialsService, MaterialIndexerService, MaterialSearchService],
})
export class MaterialsModule {}
