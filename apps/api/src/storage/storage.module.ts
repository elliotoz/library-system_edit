import { Global, Module } from "@nestjs/common";
import { DocumentContentService } from "./document-content.service";
import { StorageService } from "./storage.service";

@Global()
@Module({
  providers: [StorageService, DocumentContentService],
  exports: [StorageService, DocumentContentService],
})
export class StorageModule {}
