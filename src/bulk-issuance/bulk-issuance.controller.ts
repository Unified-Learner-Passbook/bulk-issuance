import {
  Body,
  Controller,
  Param,
  Post,
  Query,
  Res,
  Get,
  Headers,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkIssuanceService } from './bulk-issuance.service';
import { Response } from 'express';
//import { UsersService } from 'src/services/users/users.service';

@Controller('/bulk/v1/')
export class BulkIssuanceController {
  constructor(
    private readonly bulkIssuanceService: BulkIssuanceService, //private usersService: UsersService,
  ) {}

  @Get('/test')
  getUser(@Res() response: Response) {
    const TESTVAR = process.env.TESTVAR;
    const CRED_URL = process.env.CRED_URL;
    const DID_URL = process.env.DID_URL;
    const SCHEMA_URL = process.env.SCHEMA_URL;
    const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
    const REGISTRY_URL = process.env.REGISTRY_URL;
    const LEARNER_SCHEMA_FIELD = process.env.LEARNER_SCHEMA_FIELD;
    const result = {
      success: true,
      message: 'Bulk Issuance API Working 12 September 23',
      TESTVAR: TESTVAR,
      CRED_URL: CRED_URL,
      DID_URL: DID_URL,
      SCHEMA_URL: SCHEMA_URL,
      KEYCLOAK_URL: KEYCLOAK_URL,
      REGISTRY_URL: REGISTRY_URL,
      LEARNER_SCHEMA_FIELD: LEARNER_SCHEMA_FIELD,
    };
    response.status(200).send(result);
  }

  //credentials
  //get credentials issue
  @Post('/credential/issue')
  async getCredentialIssue(
    @Body() postrequest: any,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getCredentialIssue(postrequest, response);
  }
}
