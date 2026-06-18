import { ConflictException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CrewCertificatesService } from './crew-certificates.service';
import { parseRoster } from './roster-parser';
import { CertificateRenderService } from '../certificates/services/certificate-render.service';

const dupErr = () => Object.assign(new Error('dup'), { code: 11000 });
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('FEATURE-090 — roster-parser', () => {
  it('CSV: cột Họ tên/Vị trí + cột thêm; dòng thiếu tên → invalid', async () => {
    const csv =
      'Họ tên,Vị trí,Đơn vị\nNguyễn Văn Á,Trạm nước,CLB X\n,Thiếu tên,Y\n';
    const res = await parseRoster(Buffer.from(csv, 'utf8'), 'roster.csv');
    expect(res.total).toBe(2);
    expect(res.valid).toHaveLength(1);
    expect(res.invalid).toHaveLength(1);
    expect(res.valid[0].fullName).toBe('Nguyễn Văn Á');
    expect(res.valid[0].position).toBe('Trạm nước');
    expect(res.valid[0].extraFields?.['don-vi']).toBe('CLB X');
    expect(res.extraFields).toContain('Đơn vị');
  });

  it('XLSX: parse được header tiếng Việt', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('s');
    ws.addRow(['Họ tên', 'Vị trí']);
    ws.addRow(['Trần Thị B', 'Y tế']);
    const buf = await wb.xlsx.writeBuffer();
    const res = await parseRoster(Buffer.from(buf), 'roster.xlsx');
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].fullName).toBe('Trần Thị B');
    expect(res.valid[0].position).toBe('Y tế');
  });

  it('thiếu cột bắt buộc → invalid báo lỗi', async () => {
    const csv = 'Tên,Chức vụ\nA,B\n';
    const res = await parseRoster(Buffer.from(csv, 'utf8'), 'r.csv');
    expect(res.valid).toHaveLength(0);
    expect(res.invalid[0].reason).toMatch(/thiếu cột/i);
  });

  it('photoUrl chỉ nhận http/https', async () => {
    const csv =
      'Họ tên,Vị trí,Ảnh\nA,B,https://cdn/x.jpg\nC,D,file:///etc/passwd\n';
    const res = await parseRoster(Buffer.from(csv, 'utf8'), 'r.csv');
    expect(res.valid[0].photoUrl).toBe('https://cdn/x.jpg');
    expect(res.valid[1].photoUrl).toBeUndefined();
  });
});

describe('FEATURE-090 — engine generic variables (interpolate)', () => {
  const svc = new CertificateRenderService();
  const tmpl = {
    canvas: { width: 400, height: 200, backgroundColor: '#ffffff' },
    layers: [
      { type: 'text' as const, x: 10, y: 20, text: '{full_name} — {position}', fontSize: 20 },
    ],
  };

  it('render {full_name}/{position} từ variables → PNG buffer', async () => {
    const buf = await svc.render(tmpl, {
      variables: { full_name: 'Nguyễn Văn A', position: 'Tình nguyện viên' },
    });
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 8)).toEqual(PNG_SIG);
  });

  it('REGRESSION: athlete token {runner_name} vẫn render (KHÔNG variables)', async () => {
    const buf = await svc.render(
      {
        canvas: { width: 300, height: 150, backgroundColor: '#fff' },
        layers: [{ type: 'text' as const, x: 5, y: 10, text: '{runner_name}', fontSize: 18 }],
      },
      { runner_name: 'Finisher A' },
    );
    expect(buf.subarray(0, 8)).toEqual(PNG_SIG);
  });
});

describe('CrewCertificatesService', () => {
  let batchModel: any;
  let recipientModel: any;
  let render: any;
  let redis: any;
  let service: CrewCertificatesService;

  beforeEach(() => {
    batchModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    recipientModel = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    render = { render: jest.fn().mockResolvedValue(Buffer.from('PNGDATA')) };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
    service = new CrewCertificatesService(batchModel, recipientModel, render, redis);
  });

  describe('createBatch', () => {
    it('slug dup → ConflictException', async () => {
      batchModel.create.mockRejectedValue(dupErr());
      await expect(
        service.createBatch({ slug: 'crew-x', eventName: 'E' }, 'u'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('happy → shape không leak _id/createdBy', async () => {
      batchModel.create.mockResolvedValue({
        _id: '665100000000000000000090',
        slug: 'crew-x',
        eventName: 'E',
        active: true,
        extraFields: [],
        template: null,
        createdAt: new Date('2026-06-17'),
        updatedAt: new Date('2026-06-17'),
      });
      const res = await service.createBatch({ slug: 'crew-x', eventName: 'E' }, 'u');
      expect(res.id).toBe('665100000000000000000090');
      expect(res).not.toHaveProperty('_id');
      expect(res).not.toHaveProperty('createdBy');
    });
  });

  describe('searchPublic', () => {
    it('query <2 ký tự → [] (không query DB)', async () => {
      expect(await service.searchPublic('crew-x', 'a')).toEqual([]);
      expect(batchModel.findOne).not.toHaveBeenCalled();
    });

    it('diacritic-insensitive: "nguyen van a" tìm batch + map result', async () => {
      batchModel.findOne.mockReturnValue({
        select: () => ({ exec: jest.fn().mockResolvedValue({ _id: 'b1' }) }),
      });
      recipientModel.find.mockReturnValue({
        limit: () => ({
          exec: jest.fn().mockResolvedValue([
            { _id: 'r1', fullName: 'Nguyễn Văn Á', position: 'TNV', photoUrl: 'https://x', extraFields: {} },
          ]),
        }),
      });
      const res = await service.searchPublic('crew-x', 'nguyen van a');
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({ id: 'r1', fullName: 'Nguyễn Văn Á', position: 'TNV' });
      expect(res[0]).not.toHaveProperty('photoUrl'); // BR-05 không leak
    });

    it('batch inactive/không tồn tại → NotFound', async () => {
      batchModel.findOne.mockReturnValue({
        select: () => ({ exec: jest.fn().mockResolvedValue(null) }),
      });
      await expect(service.searchPublic('crew-x', 'nguyen')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('renderPublic', () => {
    const rid = '665100000000000000000091';
    it('map fullName/position/photo → render engine + cache', async () => {
      recipientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: rid,
          batchId: 'b1',
          fullName: 'Lê Văn C',
          position: 'Hậu cần',
          photoUrl: 'https://cdn/c.jpg',
          extraFields: { don_vi: 'CLB Z' },
        }),
      });
      batchModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'b1',
          active: true,
          eventName: 'Sự kiện E',
          template: { canvas: { width: 100, height: 100 }, layers: [] },
        }),
      });
      const buf = await service.renderPublic(rid);
      expect(buf.toString()).toBe('PNGDATA');
      const [, data] = render.render.mock.calls[0];
      expect(data.runner_name).toBe('Lê Văn C');
      expect(data.variables.full_name).toBe('Lê Văn C');
      expect(data.variables.position).toBe('Hậu cần');
      expect(data.runner_photo_url).toBe('https://cdn/c.jpg');
      expect(redis.set).toHaveBeenCalled();
    });

    it('recipientId không hợp lệ → NotFound', async () => {
      await expect(service.renderPublic('bad-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('batch inactive → NotFound', async () => {
      recipientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: rid, batchId: 'b1', fullName: 'X', position: 'Y', extraFields: {} }),
      });
      batchModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'b1', active: false }),
      });
      await expect(service.renderPublic(rid)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmRoster', () => {
    it('thay toàn bộ recipients + set normalizedName + extraFields labels', async () => {
      const bid = '665100000000000000000001';
      const batch = {
        _id: bid,
        extraFields: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      batchModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(batch) });
      const res = await service.confirmRoster(bid, [
        { fullName: 'Nguyễn Văn A', position: 'TNV', extraFields: { don_vi: 'X' } },
      ]);
      expect(res.inserted).toBe(1);
      expect(recipientModel.deleteMany).toHaveBeenCalledWith({ batchId: bid });
      const inserted = recipientModel.insertMany.mock.calls[0][0];
      expect(inserted[0].normalizedName).toBe('nguyen-van-a');
      expect(batch.extraFields).toEqual(['don_vi']);
    });
  });
});
