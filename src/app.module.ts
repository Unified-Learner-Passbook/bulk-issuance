import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BulkIssuanceModule } from './bulk-issuance/bulk-issuance.module';
import { CredentialsModule } from './services/credentials/credentials.module';
import { SbrcModule } from './services/sbrc/sbrc.module';
import { TelemetryModule } from './services/telemetry/telemetry.module';
import { KeycloakModule } from './services/keycloak/keycloak.module';

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
    TelemetryModule,
    KeycloakModule,
  ],
  providers: [],
})
export class AppModule {}
