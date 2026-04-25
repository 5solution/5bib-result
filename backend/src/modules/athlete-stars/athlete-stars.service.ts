import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AthleteStar,
  AthleteStarDocument,
} from './schemas/athlete-star.schema';
import { RaceResult, RaceResultDocument } from '../race-result/schemas/race-result.schema';
import { Race, RaceDocument } from '../races/schemas/race.schema';

@Injectable()
export class AthleteStarsService {
  private readonly logger = new Logger(AthleteStarsService.name);

  constructor(
    @InjectModel(AthleteStar.name)
    private readonly starModel: Model<AthleteStarDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
  ) {}

  /**
   * Star 1 athlete. Fetch snapshot từ race-result + race để denormalize.
   * Idempotent — upsert, không throw nếu đã star rồi.
   */
  async star(userId: string, raceId: string, courseId: string, bib: string) {
    const [result, race] = await Promise.all([
      this.resultModel.findOne({ raceId, courseId, bib }).lean().exec(),
      this.raceModel.findById(raceId).lean().exec(),
    ]);

    if (!result) {
      throw new NotFoundException(
        `Athlete bib=${bib} not found in race ${raceId}/${courseId}`,
      );
    }
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }

    const course = race.courses?.find((c) => c.courseId === courseId);

    const doc = await this.starModel.findOneAndUpdate(
      { userId, raceId, courseId, bib },
      {
        $setOnInsert: {
          userId,
          raceId,
          courseId,
          bib,
          athleteName: result.name || '',
          athleteGender: result.gender || '',
          athleteCategory: result.category || '',
          raceName: race.title || '',
          raceSlug: race.slug || '',
          courseName: course?.name || course?.distance || courseId,
        },
      },
      { upsert: true, new: true, lean: true },
    );
    return doc;
  }

  async unstar(userId: string, raceId: string, courseId: string, bib: string) {
    const res = await this.starModel.deleteOne({
      userId,
      raceId,
      courseId,
      bib,
    });
    return { deleted: res.deletedCount > 0 };
  }

  async list(userId: string, pageNo: number, pageSize: number) {
    const skip = (pageNo - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.starModel
        .find({ userId })
        .sort({ starred_at: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      this.starModel.countDocuments({ userId }),
    ]);
    return { data, total, pageNo, pageSize };
  }

  /**
   * Trả về danh sách bib đã star trong 1 course của user.
   * Payload nhỏ, dùng cho ranking page mark các row đã star.
   */
  async listByCourse(userId: string, raceId: string, courseId: string) {
    const docs = await this.starModel
      .find({ userId, raceId, courseId })
      .select({ bib: 1, _id: 0 })
      .lean()
      .exec();
    return docs.map((d) => d.bib);
  }
}
