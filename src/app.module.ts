import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BulkIssuanceModule } from './bulk-issuance/bulk-issuance.module';
import { CredentialsModule } from './services/credentials/credentials.module';
import { SbrcModule } from './services/sbrc/sbrc.module';
import { TelemetryModule } from './services/telemetry/telemetry.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    {
      ...HttpModule.register({}),
      global: true,
    },
    BulkIssuanceModule, 
    CredentialsModule, 
    SbrcModule, 
    TelemetryModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
