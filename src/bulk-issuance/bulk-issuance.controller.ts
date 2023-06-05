import { Body, Controller, Param, Post, Query, Res } from '@nestjs/common';
import { BulkIssuanceService } from './bulk-issuance.service';
import { Response } from 'express';
@Controller('/bulk/v1/')
export class BulkIssuanceController {

    constructor(private readonly bulkIssuanceService: BulkIssuanceService) {}

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
