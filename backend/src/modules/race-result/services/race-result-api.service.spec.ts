import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { RaceResultApiService } from './race-result-api.service';
import { RaceResultApiItem } from '../types/race-result-api.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RaceResultApiService', () => {
  let service: RaceResultApiService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RaceResultApiService],
    }).compile();
    service = moduleRef.get<RaceResultApiService>(RaceResultApiService);
    jest.clearAllMocks();
  });

  describe('fetchRaceResults()', () => {
    const mockUrl = 'https://api.raceresult.com/123456/ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';

    const mockItem: Partial<RaceResultApiItem> = {
      Bib: 1001,
      Name: 'Nguyen Van A',
      OverallRank: 1,
      Chiptimes: '{"Start":"00:00","Finish":"03:30:00"}',
      TimingPoint: 'Finish',
    };

    it('returns array on happy path 200', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [mockItem, mockItem] });

      const result = await service.fetchRaceResults(mockUrl);

      expect(result).toHaveLength(2);
      expect(result[0].Bib).toBe(1001);
      expect(mockedAxios.get).toHaveBeenCalledWith(mockUrl, { timeout: 30_000 });
    });

    it('returns empty array when response.data is non-array (vendor bug guard)', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { error: 'no data' } });

      const result = await service.fetchRaceResults(mockUrl);

      expect(result).toEqual([]);
    });

    it('returns empty array when response.data is null', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      const result = await service.fetchRaceResults(mockUrl);

      expect(result).toEqual([]);
    });

    it('throws Error on axios timeout', async () => {
      const timeoutErr = Object.assign(new Error('timeout of 30000ms exceeded'), {
        code: 'ECONNABORTED',
        isAxiosError: true,
      });
      mockedAxios.get.mockRejectedValueOnce(timeoutErr);

      await expect(service.fetchRaceResults(mockUrl)).rejects.toThrow(
        /RR API fetch failed/,
      );
    });

    it('throws Error on 5xx response with HTTP status in message', async () => {
      const httpErr = Object.assign(new Error('Request failed with status code 503'), {
        isAxiosError: true,
        response: { status: 503, data: 'Service Unavailable' },
      });
      mockedAxios.get.mockRejectedValueOnce(httpErr);

      await expect(service.fetchRaceResults(mockUrl)).rejects.toThrow(/HTTP 503/);
    });

    it('respects custom timeout override', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      await service.fetchRaceResults(mockUrl, 5_000);

      expect(mockedAxios.get).toHaveBeenCalledWith(mockUrl, { timeout: 5_000 });
    });

    it('masks 32-char API token in error log (no leak to stdout)', async () => {
      const httpErr = Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 500 },
      });
      mockedAxios.get.mockRejectedValueOnce(httpErr);
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      await expect(service.fetchRaceResults(mockUrl)).rejects.toThrow();

      const logged = loggerSpy.mock.calls[0]?.[0] as string;
      expect(logged).toContain('/***');
      expect(logged).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
    });
  });
});
