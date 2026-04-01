import { Test, TestingModule } from '@nestjs/testing';
import { S3Client } from '@aws-sdk/client-s3';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  let service: UploadService;

  const mockS3Client = {
    send: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: S3Client, useValue: mockS3Client },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload a file and return url', async () => {
      mockS3Client.send.mockResolvedValue({});

      const file = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await service.uploadFile(file);

      expect(mockS3Client.send).toHaveBeenCalled();
      expect(typeof result).toBe('string');
      expect(result).toContain('test.jpg');
    });

    it('should return false on error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('S3 error'));

      const file = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await service.uploadFile(file);

      expect(result).toBe(false);
    });
  });
});
