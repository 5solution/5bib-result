import { of } from 'rxjs';
import { IglooHttpService } from './igloo-http.service';
import { CreateIglooRequestPayload } from '../utils/igloo-helpers';

/**
 * Igloo bọc response `{ success, data: {...} }` (verified PROD 2026-06-16).
 * Test envelope unwrap + fallback flat.
 */
describe('IglooHttpService — response envelope parsing', () => {
  function make(httpMock: { post?: jest.Mock; get?: jest.Mock }): IglooHttpService {
    return new IglooHttpService(httpMock as never);
  }
  const payload = {} as CreateIglooRequestPayload;

  describe('createRequest', () => {
    it('đọc requestId trong envelope {success,data:{requestId}}', async () => {
      const http = {
        post: jest.fn(() =>
          of({ status: 202, data: { success: true, data: { requestId: 'IGL-1' } } }),
        ),
      };
      const svc = make(http);
      await expect(svc.createRequest(payload)).resolves.toEqual({
        iglooRequestId: 'IGL-1',
      });
    });

    it('fallback flat {requestId} (nếu API đổi)', async () => {
      const http = { post: jest.fn(() => of({ status: 202, data: { requestId: 'IGL-2' } })) };
      await expect(make(http).createRequest(payload)).resolves.toEqual({
        iglooRequestId: 'IGL-2',
      });
    });

    it('throw khi thiếu requestId', async () => {
      const http = { post: jest.fn(() => of({ status: 202, data: { success: true, data: {} } })) };
      await expect(make(http).createRequest(payload)).rejects.toThrow();
    });
  });

  describe('getStatus', () => {
    it('đọc status/contractNo/cert trong envelope', async () => {
      const http = {
        get: jest.fn(() =>
          of({
            status: 200,
            data: {
              success: true,
              data: {
                status: 'SUCCESS',
                gicContractNo: 'IGL/GTDAPI/260616/00000158',
                certificateUrl: 'https://gic/cert.pdf',
              },
            },
          }),
        ),
      };
      await expect(make(http).getStatus('IGL-1')).resolves.toEqual({
        status: 'SUCCESS',
        gicContractNo: 'IGL/GTDAPI/260616/00000158',
        certificateUrl: 'https://gic/cert.pdf',
      });
    });

    it('default PENDING + null khi thiếu field', async () => {
      const http = { get: jest.fn(() => of({ status: 200, data: { success: true, data: {} } })) };
      await expect(make(http).getStatus('IGL-1')).resolves.toEqual({
        status: 'PENDING',
        gicContractNo: null,
        certificateUrl: null,
      });
    });
  });
});
