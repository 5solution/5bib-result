import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ResultKioskDisplay,
  ResultKioskDisplayDocument,
} from '../schemas/result-kiosk-display.schema';
import { UpdateDisplayConfigDto } from '../dto/display-config.dto';

const PRESETS = {
  DEFAULT: {
    heroChoice: 'rank' as const,
    visibleSections: {
      rank: true,
      finishTime: true,
      splits: true,
      sponsorBanner: true,
      customMessage: false,
      qrShare: false,
      photo: false,
    },
    themeColor: '#FF0E65',
    customMessage: '',
    sponsorLogos: [],
    soundEnabled: true,
    idleTimeoutSeconds: 60,
  },
  MINIMAL: {
    heroChoice: 'finish-time' as const,
    visibleSections: {
      rank: true,
      finishTime: true,
      splits: false,
      sponsorBanner: false,
      customMessage: false,
      qrShare: false,
      photo: false,
    },
    themeColor: '#1c1917',
    customMessage: '',
    sponsorLogos: [],
    soundEnabled: false,
    idleTimeoutSeconds: 30,
  },
  PREMIUM: {
    heroChoice: 'photo' as const,
    visibleSections: {
      rank: true,
      finishTime: true,
      splits: true,
      sponsorBanner: true,
      customMessage: true,
      qrShare: false,
      photo: true,
    },
    themeColor: '#1d4ed8',
    customMessage: '',
    sponsorLogos: [],
    soundEnabled: true,
    idleTimeoutSeconds: 90,
  },
};

@Injectable()
export class ResultKioskDisplayService {
  private readonly logger = new Logger(ResultKioskDisplayService.name);

  constructor(
    @InjectModel(ResultKioskDisplay.name)
    private readonly displayModel: Model<ResultKioskDisplayDocument>,
  ) {}

  /** Lazy-create on first GET. Returns DEFAULT preset doc if not exists. */
  async getOrCreate(mongoRaceId: string): Promise<ResultKioskDisplayDocument> {
    if (!mongoRaceId || mongoRaceId.length < 8) {
      throw new BadRequestException('Invalid mongoRaceId');
    }
    let doc = await this.displayModel.findOne({ mongoRaceId }).exec();
    if (!doc) {
      // Deep clone preset to avoid sharing mutable references (sponsorLogos array,
      // visibleSections object) between docs lazy-created from the same preset.
      const fresh = JSON.parse(JSON.stringify(PRESETS.DEFAULT));
      doc = await this.displayModel.create({
        mongoRaceId,
        ...fresh,
        preset: 'DEFAULT',
      });
      this.logger.log(`[lazy-create] mongoRaceId=${mongoRaceId} preset=DEFAULT`);
    }
    return doc;
  }

  async update(
    mongoRaceId: string,
    body: UpdateDisplayConfigDto,
    byUserId: string,
  ): Promise<ResultKioskDisplayDocument> {
    const doc = await this.getOrCreate(mongoRaceId);

    if (body.heroChoice !== undefined) doc.heroChoice = body.heroChoice;
    if (body.visibleSections !== undefined) doc.visibleSections = body.visibleSections;
    if (body.themeColor !== undefined) doc.themeColor = body.themeColor;
    if (body.customMessage !== undefined) doc.customMessage = body.customMessage;
    if (body.sponsorLogos !== undefined) doc.sponsorLogos = body.sponsorLogos;
    if (body.soundEnabled !== undefined) doc.soundEnabled = body.soundEnabled;
    if (body.idleTimeoutSeconds !== undefined) doc.idleTimeoutSeconds = body.idleTimeoutSeconds;
    if (body.preset !== undefined) {
      doc.preset = body.preset;
      // Apply preset values when admin chose a non-CUSTOM preset.
      if (body.preset !== 'CUSTOM') {
        const cloned = JSON.parse(JSON.stringify(PRESETS[body.preset]));
        doc.heroChoice = cloned.heroChoice;
        doc.visibleSections = cloned.visibleSections;
        doc.themeColor = cloned.themeColor;
        doc.soundEnabled = cloned.soundEnabled;
        doc.idleTimeoutSeconds = cloned.idleTimeoutSeconds;
      }
    }

    doc.updatedByUserId = byUserId;
    await doc.save();
    this.logger.log(`[update] mongoRaceId=${mongoRaceId} by=${byUserId}`);
    return doc;
  }

  async resetToPreset(
    mongoRaceId: string,
    preset: 'DEFAULT' | 'MINIMAL' | 'PREMIUM',
    byUserId: string,
  ): Promise<ResultKioskDisplayDocument> {
    const doc = await this.getOrCreate(mongoRaceId);
    const p = PRESETS[preset];
    if (!p) throw new BadRequestException('Unknown preset');

    // Clone preset structures to avoid sharing references across docs.
    const cloned = JSON.parse(JSON.stringify(p));
    doc.heroChoice = cloned.heroChoice;
    doc.visibleSections = cloned.visibleSections;
    doc.themeColor = cloned.themeColor;
    doc.customMessage = cloned.customMessage;
    doc.sponsorLogos = cloned.sponsorLogos;
    doc.soundEnabled = p.soundEnabled;
    doc.idleTimeoutSeconds = p.idleTimeoutSeconds;
    doc.preset = preset;
    doc.updatedByUserId = byUserId;
    await doc.save();
    return doc;
  }

  async appendSponsorLogo(
    mongoRaceId: string,
    url: string,
    byUserId: string,
  ): Promise<ResultKioskDisplayDocument> {
    const doc = await this.getOrCreate(mongoRaceId);
    if (doc.sponsorLogos.length >= 5) {
      throw new BadRequestException('Maximum 5 sponsor logos per race');
    }
    doc.sponsorLogos.push(url);
    doc.updatedByUserId = byUserId;
    await doc.save();
    return doc;
  }

  async removeSponsorLogo(
    mongoRaceId: string,
    url: string,
    byUserId: string,
  ): Promise<ResultKioskDisplayDocument> {
    const doc = await this.displayModel.findOne({ mongoRaceId }).exec();
    if (!doc) throw new NotFoundException('Display config not found');
    doc.sponsorLogos = doc.sponsorLogos.filter((u) => u !== url);
    doc.updatedByUserId = byUserId;
    await doc.save();
    return doc;
  }
}
