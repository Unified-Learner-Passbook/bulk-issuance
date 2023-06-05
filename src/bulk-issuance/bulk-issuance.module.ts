import { Module } from '@nestjs/common';
import { BulkIssuanceService } from './bulk-issuance.service';
import { BulkIssuanceController } from './bulk-issuance.controller';
import { CredentialsModule } from 'src/services/credentials/credentials.module';
import { SbrcModule } from 'src/services/sbrc/sbrc.module';
import { TelemetryModule } from 'src/services/telemetry/telemetry.module';


@Module({
  imports: [CredentialsModule, SbrcModule, TelemetryModule],
  controllers: [BulkIssuanceController],
  providers: [BulkIssuanceService],
  
})
export class BulkIssuanceModule {}
