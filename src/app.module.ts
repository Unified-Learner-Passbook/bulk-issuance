import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BulkIssuanceModule } from './bulk-issuance/bulk-issuance.module';
import { CredentialsModule } from './services/credentials/credentials.module';
import { SbrcModule } from './services/sbrc/sbrc.module';
import { TelemetryModule } from './services/telemetry/telemetry.module';
import { AadharModule } from './services/aadhar/aadhar.module';
import { KeycloakModule } from './services/keycloak/keycloak.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './services/users/users.module';

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
    AadharModule,
    KeycloakModule,
    // TypeOrmModule.forRoot({
    //   type: 'postgres',
    //   host: '64.227.129.71',
    //   port: 5432,
    //   username: 'postgres',
    //   password: '4E3k%nC*AG',
    //   database: 'middleware_db',
    //   entities: [__dirname + '/**/*.entity{.ts,.js}'],
    //   synchronize: true,
    //   logging: true
    // }),
    //UsersModule,
  ],
  providers: [],
})
export class AppModule {}
