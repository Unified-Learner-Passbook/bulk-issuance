import { Test, TestingModule } from '@nestjs/testing';
import { BulkIssuanceService } from './bulk-issuance.service';

describe('BulkIssuanceService', () => {
  let service: BulkIssuanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BulkIssuanceService],
    }).compile();

    service = module.get<BulkIssuanceService>(BulkIssuanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
