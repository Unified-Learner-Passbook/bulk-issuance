import { Module } from '@nestjs/common';
import { SbrcService } from './sbrc.service';

@Module({
  providers: [SbrcService],
  exports: [SbrcService]
})
export class SbrcModule {}
