import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ChipMapping,
  ChipMappingDocument,
} from '../schemas/chip-mapping.schema';
import {
  ChipVerification,
  ChipVerificationDocument,
} from '../schemas/chip-verification.schema';
import { ChipStatsResponseDto } from '../dto/chip-lookup.dto';

@Injectable()
export class ChipStatsService {
  constructor(
    @InjectModel(ChipMapping.name)
    private readonly mappingModel: Model<ChipMappingDocument>,
    @InjectModel(ChipVerification.name)
    private readonly verificationModel: Model<ChipVerificationDocument>,
  ) {}

  async forRace(raceId: number): Promise<ChipStatsResponseDto> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [totalMappings, totalVerifiedAgg, totalAttempts, recent5m] =
      await Promise.all([
        this.mappingModel.countDocuments({
          mysql_race_id: raceId,
          deleted: false,
          status: 'ACTIVE',
        }),
        this.verificationModel
          .aggregate<{ count: number }>([
            {
              $match: {
                mysql_race_id: raceId,
                result: 'FOUND',
                is_first_verify: true,
              },
            },
            { $count: 'count' },
          ])
          .exec(),
        this.verificationModel.countDocuments({ mysql_race_id: raceId }),
        this.verificationModel.countDocuments({
          mysql_race_id: raceId,
          verified_at: { $gte: fiveMinAgo },
        }),
      ]);

    const totalVerified = totalVerifiedAgg[0]?.count ?? 0;
    return {
      total_mappings: totalMappings,
      total_verified: totalVerified,
      total_attempts: totalAttempts,
      recent_5m: recent5m,
    };
  }
}
