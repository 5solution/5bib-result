import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  RaceConfig,
  RaceResult,
  RaceResultDocument,
} from '../interfaces/race-result.interface';
import { RaceElasticsearchService } from './elasticsearch.service';
import { GetRaceResultsDto } from '../dto/get-race-results.dto';

@Injectable()
export class RaceResultService {
  private readonly logger = new Logger(RaceResultService.name);

  private readonly raceConfigs: RaceConfig[] = [
    {
      race_id: 373872,
      distance: '100km',
      course_id: '100km',
      api_url:
        'https://api.raceresult.com/373872/DRUJ4JZIAZVR9HL3Z95VMT3N1EOUYRX6',
    },
    {
      race_id: 373872,
      distance: '70km',
      course_id: '70km',
      api_url:
        'https://api.raceresult.com/373872/L4OGZSDRG90JJB34CWIAM6I5BBQS744E',
    },
    {
      race_id: 373872,
      distance: '42km',
      course_id: '42km',
      api_url:
        'https://api.raceresult.com/373872/XNMXT8815X4PMOH8PIQJU9BMOILKSR7Q',
    },
    {
      race_id: 373872,
      distance: '25km',
      course_id: '25km',
      api_url:
        'https://api.raceresult.com/373872/OBZ7O5A02PGVHAOTJ2F7Y9QGE6VXDIZK',
    },
    {
      race_id: 373872,
      distance: '10km',
      course_id: '10km',
      api_url:
        'https://api.raceresult.com/373872/WKI4EML9T6R7Z582HRKDXOF2188697KX',
    },
  ];

  constructor(private readonly esService: RaceElasticsearchService) {}

  async syncAllRaceResults(): Promise<void> {
    this.logger.log('Starting race results sync...');

    for (const config of this.raceConfigs) {
      await this.syncRaceResult(config);
    }

    this.logger.log('Race results sync completed');
  }

  private normalizeRankValue(value: any): {
    original: string;
    numeric: number | null;
  } {
    const strValue = String(value);
    const numValue = parseInt(strValue, 10);
    return {
      original: strValue,
      numeric: isNaN(numValue) ? null : numValue,
    };
  }

  private async syncRaceResult(config: RaceConfig): Promise<void> {
    try {
      this.logger.log(`Syncing ${config.distance} race results...`);

      const response = await axios.get<RaceResult[]>(config.api_url, {
        timeout: 30000,
      });

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(
          `Invalid data received for ${config.distance}: ${typeof response.data}`,
        );
        return;
      }

      const documents: RaceResultDocument[] = response.data.map((result) => {
        const overallRank = this.normalizeRankValue(result.OverallRank);
        const genderRank = this.normalizeRankValue(result.GenderRank);
        const catRank = this.normalizeRankValue(result.CatRank);
        const overrankLive = this.normalizeRankValue(result.OverrankLive);

        return {
          ...result,
          OverallRank: overallRank.original,
          OverallRankNumeric: overallRank.numeric,
          GenderRank: genderRank.original,
          GenderRankNumeric: genderRank.numeric,
          CatRank: catRank.original,
          CatRankNumeric: catRank.numeric,
          OverrankLive: overrankLive.original,
          OverrankLiveNumeric: overrankLive.numeric,
          race_id: config.race_id,
          course_id: config.course_id,
          distance: config.distance,
          synced_at: new Date(),
        } as any;
      });

      if (documents.length > 0) {
        await this.esService.bulkUpsert(documents);
        this.logger.log(
          `Successfully synced ${documents.length} results for ${config.distance}`,
        );
      } else {
        this.logger.warn(`No results found for ${config.distance}`);
      }
    } catch (error) {
      this.logger.error(
        `Error syncing ${config.distance}: ${error.message}`,
        error.stack,
      );
    }
  }

  async getRaceResults(dto: GetRaceResultsDto) {
    const from = (dto.pageNo - 1) * dto.pageSize;
    const sortOrder = dto.sortDirection === 'ASC' ? 'asc' : 'desc';

    const result = await this.esService.search({
      course_id: dto.course_id,
      name: dto.name,
      gender: dto.gender,
      category: dto.category,
      from,
      size: dto.pageSize,
      sortField: dto.sortField,
      sortOrder,
    });

    return {
      data: result.results,
      pagination: {
        pageNo: dto.pageNo,
        pageSize: dto.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / dto.pageSize),
      },
    };
  }
}
