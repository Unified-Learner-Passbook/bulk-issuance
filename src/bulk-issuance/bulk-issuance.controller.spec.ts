import { Test, TestingModule } from '@nestjs/testing';
import { BulkIssuanceController } from './bulk-issuance.controller';

describe('BulkIssuanceController', () => {
  let controller: BulkIssuanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkIssuanceController],
    }).compile();

    controller = module.get<BulkIssuanceController>(BulkIssuanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
