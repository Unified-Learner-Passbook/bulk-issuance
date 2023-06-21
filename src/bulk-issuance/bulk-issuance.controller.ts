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
    constructor(private readonly bulkIssuanceService: BulkIssuanceService, private usersService: UsersService) { }

    @Get('/test')
    getUser(@Res() response: Response) {
        const result = {
            success: true,
            message: 'Bulk Issuance API Working 16 June 23',
        };
        response.status(200).send(result);
    }

    @Post('/clienttoken')
    async getClientToken(
        @Body('username') username: string,
        @Body('password') password: string,
        @Res() response: Response,
    ) {
        return this.bulkIssuanceService.getToken(username, password, response);
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
        @Body('email') email: string,
        @Body('mobile') mobile: string,
        @Body('userid') userid: string,
        @Res() response: Response,
    ) {
        const jwt = auth.replace('Bearer ', '');
        return this.bulkIssuanceService.getIssuerRegister(
            jwt,
            name,
            email,
            mobile,
            userid,
            response,
        );
    }

    @Post('/issuertoken')
    async getIssuerToken(
        @Body('username') username: string,
        @Body('password') password: string,
        @Res() response: Response,
    ) {
        return this.bulkIssuanceService.getToken(username, password, response);
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
