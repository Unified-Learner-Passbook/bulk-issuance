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
import { UsersService } from 'src/services/users/users.service';

@Controller('/bulk/v1/')
export class BulkIssuanceController {
  constructor(
    private readonly bulkIssuanceService: BulkIssuanceService,
    private usersService: UsersService,
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
      message: 'Bulk Issuance API Working 23 July 23',
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

  @Post('/clienttoken')
  async getClientToken(
    @Body('password') password: string,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getClientToken(password, response);
  }

  @Post('/getdid')
  async getDID(
    @Body('uniquetext') uniquetext: string,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getDID(uniquetext, response);
  }

  @Post('/issuerregister')
  async getIssuerRegister(
    @Headers('Authorization') auth: string,
    @Body('name') name: string,
    @Body('did') did: string,
    @Body('username') username: string,
    @Body('password') password: string,
    @Res() response: Response,
  ) {
    const jwt = auth.replace('Bearer ', '');
    return this.bulkIssuanceService.getIssuerRegister(
      jwt,
      name,
      did,
      username,
      password,
      response,
    );
  }

  @Get('/issuerdetail')
  async getDetailIssuer(
    @Headers('Authorization') auth: string,
    @Res() response: Response,
  ) {
    const jwt = auth.replace('Bearer ', '');
    return this.bulkIssuanceService.getDetailIssuer(jwt, response);
  }

  @Get('/issuerlist')
  async getListIssuer(@Res() response: Response) {
    return this.bulkIssuanceService.getListIssuer(response);
  }

  //instructor
  //register
  @Post('/instructor/register')
  async registerInstructor(
    @Body('name') name: string,
    @Body('dob') dob: string,
    @Body('gender') gender: string,
    @Body('recoveryphone') recoveryphone: string,
    @Body('issuer_did') issuer_did: string,
    @Body('username') username: string,
    @Body('email') email: string,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.registerInstructor(
      name,
      dob,
      gender,
      recoveryphone,
      issuer_did,
      username,
      email,
      response,
    );
  }
  //aadhaar
  @Post('/instructor/aadhaar')
  async getAadhaarToken(
    @Res() response: Response,
    @Body('aadhaar_id') aadhaar_id: string,
    @Body('aadhaar_name') aadhaar_name: string,
    @Body('aadhaar_dob') aadhaar_dob: string,
    @Body('aadhaar_gender') aadhaar_gender: string,
  ) {
    return this.bulkIssuanceService.getAadhaarTokenUpdate(
      response,
      aadhaar_id,
      aadhaar_name,
      aadhaar_dob,
      aadhaar_gender,
    );
  }
  //udise
  @Post('/instructor/udise')
  async getUDISEUpdate(
    @Res() response: Response,
    @Body('school_name') school_name: string,
    @Body('school_id') school_id: string,
    @Body('name') name: string,
    @Body('dob') dob: string,
    @Body('gender') gender: string,
  ) {
    return this.bulkIssuanceService.getUDISEUpdate(
      response,
      school_name,
      school_id,
      name,
      dob,
      gender,
    );
  }
  //get details
  @Get('/instructor/getdetail')
  async getDetailInstructor(
    @Headers('Authorization') auth: string,
    @Res() response: Response,
  ) {
    const jwt = auth.replace('Bearer ', '');
    return this.bulkIssuanceService.getDetailInstructor(jwt, response);
  }
  @Post('/instructor/digi/getdetail')
  async getDetailDigiInstructor(
    @Headers('Authorization') auth: string,
    @Body('name') name: string,
    @Body('dob') dob: string,
    @Body('gender') gender: string,
    @Res() response: Response,
  ) {
    const jwt = auth.replace('Bearer ', '');
    return this.bulkIssuanceService.getDetailDigiInstructor(
      jwt,
      name,
      dob,
      gender,
      response,
    );
  }

  //get credentials/schema/required
  @Post('/credential/schema/create')
  async getCredentialSchemaCreate(
    @Body() postrequest: any,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getCredentialSchemaCreate(
      postrequest,
      response,
    );
  }

  @Post('/credential/schema/list')
  async getCredentialSchemaList(
    @Body() postrequest: any,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getCredentialSchemaList(
      postrequest,
      response,
    );
  }

  //schema template create
  @Post('/credential/schema/template/create')
  async getCredentialSchemaTemplateCreate(
    @Body() postrequest: any,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getCredentialSchemaTemplateCreate(
      postrequest,
      response,
    );
  }

  @Post('/credential/schema/template/list')
  async getCredentialSchemaTemplateList(
    @Body() postrequest: any,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getCredentialSchemaTemplateList(
      postrequest,
      response,
    );
  }

  @Post('/credential/schema/fields')
  async getSchemaFields(
    @Body('schema_id') schema_id: string,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getSchemaFields(schema_id, response);
  }

  @Post('/credential/issue')
  async getCredentialIssue(
    @Body() postrequest: any,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getCredentialIssue(postrequest, response);
  }

  @Post('/user/create')
  async getUserCreate(@Body() postrequest: any, @Res() response: Response) {
    return this.bulkIssuanceService.getUserCreate(postrequest, response);
  }

  //deprecated
  @Post('/issuertoken')
  async getIssuerToken(
    @Body('username') username: string,
    @Body('password') password: string,
    @Res() response: Response,
  ) {
    return this.bulkIssuanceService.getTokenLogin(username, password, response);
  }
  @Post('/uploadFiles/:type')
  @UseInterceptors(FileInterceptor('csvfile'))
  async getUploadFiles(
    @Headers('Authorization') auth: string,
    @Param('type') type: string,
    @Body('issuerDetail') issuerDetail: any,
    @Body('vcData') vcData: any,
    @Body('credentialSubjectCommon') credentialSubjectCommon: any,
    @UploadedFile() csvfile: Express.Multer.File,
    @Res() response: Response,
  ) {
    const jwt = auth.replace('Bearer ', '');
    return this.bulkIssuanceService.getUploadFiles(
      jwt,
      type,
      issuerDetail,
      vcData,
      credentialSubjectCommon,
      csvfile,
      response,
    );
  }

  @Post('/upload/:type')
  bulkUpload(
    @Param('type') type: string,
    @Body() payload: any,
    @Res() response: Response,
  ) {
    console.log('body', payload);
    console.log('params', type);

    if (type === 'proofOfAssessment') {
      var schemaId = process.env.PROOF_OF_ASSESSMENT;
    }
    if (type === 'proofOfEnrollment') {
      var schemaId = process.env.PROOF_OF_ENROLLMENT;
    }
    if (type === 'proofOfBenifits') {
      var schemaId = process.env.PROOF_OF_BENIFIT;
    }
    return this.bulkIssuanceService.issueBulkCredential(
      payload,
      schemaId,
      type,
      response,
    );
  }
}
