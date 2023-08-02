import { Module } from '@nestjs/common';
import { AadharService } from './aadhar.service';

@Module({
  providers: [AadharService],
  exports: [AadharService]
})
export class AadharModule {}
