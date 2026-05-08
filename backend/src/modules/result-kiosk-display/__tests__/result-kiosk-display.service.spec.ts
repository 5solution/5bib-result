import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResultKioskDisplayService } from '../services/result-kiosk-display.service';
import { ResultKioskDisplay } from '../schemas/result-kiosk-display.schema';

/**
 * F-017 backend unit tests — verify lazy-create + preset apply + sponsor logo
 * append/remove + per-race idempotent get-or-create.
 *
 * Mock Mongoose model (in-memory map) — no real Mongo dependency.
 */

interface FakeDoc {
  mongoRaceId: string;
  heroChoice: string;
  visibleSections: Record<string, boolean>;
  themeColor: string;
  customMessage: string;
  sponsorLogos: string[];
  soundEnabled: boolean;
  idleTimeoutSeconds: number;
  preset: string;
  updatedByUserId?: string;
  save: () => Promise<void>;
}

function makeFakeModel() {
  const store = new Map<string, FakeDoc>();
  const FakeModel: any = function (this: any, doc: any) {
    Object.assign(this, doc);
    this.save = async function () {
      store.set(this.mongoRaceId, this);
    };
    return this;
  };
  FakeModel.findOne = (filter: { mongoRaceId: string }) => ({
    exec: async () => store.get(filter.mongoRaceId) ?? null,
  });
  FakeModel.create = async (input: Partial<FakeDoc>) => {
    const doc: FakeDoc = {
      mongoRaceId: input.mongoRaceId!,
      heroChoice: (input as any).heroChoice ?? 'rank',
      visibleSections: (input as any).visibleSections ?? {
        rank: true,
        finishTime: true,
        splits: true,
        sponsorBanner: true,
        customMessage: false,
        qrShare: false,
        photo: false,
      },
      themeColor: (input as any).themeColor ?? '#FF0E65',
      customMessage: (input as any).customMessage ?? '',
      sponsorLogos: (input as any).sponsorLogos ?? [],
      soundEnabled: (input as any).soundEnabled ?? true,
      idleTimeoutSeconds: (input as any).idleTimeoutSeconds ?? 60,
      preset: (input as any).preset ?? 'DEFAULT',
      save: async function () {
        store.set(this.mongoRaceId, this);
      },
    } as FakeDoc;
    store.set(doc.mongoRaceId, doc);
    return doc;
  };
  return { FakeModel, store };
}

describe('ResultKioskDisplayService (F-017)', () => {
  let service: ResultKioskDisplayService;
  let store: Map<string, FakeDoc>;

  beforeEach(async () => {
    const fixture = makeFakeModel();
    store = fixture.store;
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ResultKioskDisplayService,
        { provide: getModelToken(ResultKioskDisplay.name), useValue: fixture.FakeModel },
      ],
    }).compile();
    service = moduleRef.get(ResultKioskDisplayService);
  });

  it('lazy-creates DEFAULT preset on first GET', async () => {
    expect(store.size).toBe(0);
    const doc = await service.getOrCreate('race_abc12345');
    expect(doc.preset).toBe('DEFAULT');
    expect(doc.heroChoice).toBe('rank');
    expect(doc.visibleSections.rank).toBe(true);
    expect(doc.visibleSections.qrShare).toBe(false);
    expect(store.size).toBe(1);
  });

  it('idempotent — second GET returns existing doc', async () => {
    const a = await service.getOrCreate('race_xyz98765');
    const b = await service.getOrCreate('race_xyz98765');
    expect(a.mongoRaceId).toBe(b.mongoRaceId);
    expect(store.size).toBe(1);
  });

  it('rejects invalid mongoRaceId (BR-RK validation)', async () => {
    await expect(service.getOrCreate('')).rejects.toThrow();
    await expect(service.getOrCreate('short')).rejects.toThrow();
  });

  it('update applies partial fields and stamps updatedByUserId', async () => {
    await service.getOrCreate('race_partial1');
    const updated = await service.update(
      'race_partial1',
      { heroChoice: 'finish-time', themeColor: '#1d4ed8' },
      'admin@5bib',
    );
    expect(updated.heroChoice).toBe('finish-time');
    expect(updated.themeColor).toBe('#1d4ed8');
    expect(updated.updatedByUserId).toBe('admin@5bib');
  });

  it('resetToPreset applies MINIMAL bundle', async () => {
    await service.getOrCreate('race_minimal1');
    const result = await service.resetToPreset('race_minimal1', 'MINIMAL', 'admin');
    expect(result.preset).toBe('MINIMAL');
    expect(result.heroChoice).toBe('finish-time');
    expect(result.visibleSections.splits).toBe(false);
    expect(result.soundEnabled).toBe(false);
  });

  it('appendSponsorLogo respects 5-logo cap', async () => {
    await service.getOrCreate('race_sponsor1');
    for (let i = 0; i < 5; i++) {
      await service.appendSponsorLogo('race_sponsor1', `https://cdn/logo${i}.png`, 'admin');
    }
    await expect(
      service.appendSponsorLogo('race_sponsor1', 'https://cdn/logo6.png', 'admin'),
    ).rejects.toThrow(/Maximum 5/);
  });

  it('removeSponsorLogo filters out URL', async () => {
    await service.getOrCreate('race_remove1');
    await service.appendSponsorLogo('race_remove1', 'https://cdn/a.png', 'admin');
    await service.appendSponsorLogo('race_remove1', 'https://cdn/b.png', 'admin');
    const out = await service.removeSponsorLogo('race_remove1', 'https://cdn/a.png', 'admin');
    expect(out.sponsorLogos).toEqual(['https://cdn/b.png']);
  });

  it('PREMIUM preset enables photo + customMessage sections', async () => {
    await service.getOrCreate('race_premium1');
    const out = await service.resetToPreset('race_premium1', 'PREMIUM', 'admin');
    expect(out.visibleSections.photo).toBe(true);
    expect(out.visibleSections.customMessage).toBe(true);
    expect(out.heroChoice).toBe('photo');
  });
});
