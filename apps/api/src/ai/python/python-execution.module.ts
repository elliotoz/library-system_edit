import { Module } from '@nestjs/common';
import { PythonExecutionService } from './python-execution.service';

@Module({
  providers: [PythonExecutionService],
  exports: [PythonExecutionService],
})
export class PythonExecutionModule {}
