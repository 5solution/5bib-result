import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { RaceResultDocument } from '../interfaces/race-result.interface';

@Injectable()
export class RaceElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(RaceElasticsearchService.name);
  private readonly indexName = 'race-results';
  private readonly indexAliasName = 'race-results-alias';

  constructor(private readonly esService: ElasticsearchService) {}

  async onModuleInit() {
    await this.createIndexIfNotExists();
  }

  private async createIndexIfNotExists() {
    try {
      const indexExists = await this.esService.indices.exists({
        index: this.indexName,
      });

      // Delete and recreate index if it exists (for development)
      if (indexExists) {
        this.logger.warn(`Index ${this.indexName} already exists, deleting...`);
        await this.esService.indices.delete({ index: this.indexName });
      }

      await this.esService.indices.create({
        index: this.indexName,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
        mappings: {
          properties: {
            Bib: { type: 'integer' },
            Name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            OverallRank: { type: 'keyword' },
            OverallRankNumeric: { type: 'integer' },
            GenderRank: { type: 'keyword' },
            GenderRankNumeric: { type: 'integer' },
            CatRank: { type: 'keyword' },
            CatRankNumeric: { type: 'integer' },
            Gender: { type: 'keyword' },
            Category: { type: 'keyword' },
            ChipTime: { type: 'keyword' },
            GunTime: { type: 'keyword' },
            TimingPoint: { type: 'keyword' },
            Pace: { type: 'keyword' },
            Certi: { type: 'keyword' },
            Certificate: { type: 'keyword' },
            OverallRanks: { type: 'text' },
            GenderRanks: { type: 'text' },
            Chiptimes: { type: 'text' },
            Guntimes: { type: 'text' },
            Paces: { type: 'text' },
            TODs: { type: 'text' },
            Sectors: { type: 'text' },
            OverrankLive: { type: 'keyword' },
            OverrankLiveNumeric: { type: 'integer' },
            Gap: { type: 'keyword' },
            Nationality: { type: 'keyword' },
            Nation: { type: 'keyword' },
            race_id: { type: 'integer' },
            course_id: { type: 'keyword' },
            distance: { type: 'keyword' },
            synced_at: { type: 'date' },
          },
        },
      } as any);

      // Create alias
      await this.esService.indices.putAlias({
        index: this.indexName,
        name: this.indexAliasName,
      });

      this.logger.log(`Index ${this.indexName} created successfully`);
    } catch (error) {
      this.logger.error(`Error creating index: ${error.message}`, error.stack);
    }
  }

  async bulkUpsert(documents: RaceResultDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const body = documents.flatMap((doc) => [
      {
        update: {
          _index: this.indexAliasName,
          _id: `${doc.race_id}-${doc.course_id}-${doc.Bib}`,
        },
      },
      {
        doc: doc,
        doc_as_upsert: true,
      },
    ]);

    try {
      const result = await this.esService.bulk({
        operations: body,
        refresh: true,
      } as any);

      if (result.errors) {
        const erroredDocuments = [];
        result.items.forEach((action, i) => {
          const operation = Object.keys(action)[0];
          if (action[operation].error) {
            erroredDocuments.push({
              status: action[operation].status,
              error: action[operation].error,
            });
          }
        });
        this.logger.error(
          `Bulk upsert had errors: ${JSON.stringify(erroredDocuments)}`,
        );
      } else {
        this.logger.log(`Bulk upserted ${documents.length} documents`);
      }
    } catch (error) {
      this.logger.error(`Bulk upsert error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async search(params: {
    course_id?: string;
    name?: string;
    gender?: string;
    category?: string;
    from: number;
    size: number;
    sortField: string;
    sortOrder: 'asc' | 'desc';
  }) {
    const must: any[] = [];

    if (params.course_id) {
      must.push({ term: { course_id: params.course_id } });
    }

    if (params.name) {
      must.push({
        match: {
          Name: {
            query: params.name,
            fuzziness: 'AUTO',
          },
        },
      });
    }

    if (params.gender) {
      must.push({ term: { Gender: params.gender } });
    }

    if (params.category) {
      must.push({ term: { Category: params.category } });
    }

    const query = must.length > 0 ? { bool: { must } } : { match_all: {} };

    // Map sort field to numeric version for proper ranking
    const sortFieldMap: Record<string, string> = {
      OverallRank: 'OverallRankNumeric',
      GenderRank: 'GenderRankNumeric',
      CatRank: 'CatRankNumeric',
      OverrankLive: 'OverrankLiveNumeric',
    };

    const actualSortField =
      sortFieldMap[params.sortField] || params.sortField;

    try {
      const result = await this.esService.search({
        index: this.indexAliasName,
        query,
        from: params.from,
        size: params.size,
        sort: [{ [actualSortField]: { order: params.sortOrder } }],
      } as any);

      return {
        total: result.hits.total['value'] || 0,
        results: result.hits.hits.map((hit) => hit._source),
      };
    } catch (error) {
      this.logger.error(`Search error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
