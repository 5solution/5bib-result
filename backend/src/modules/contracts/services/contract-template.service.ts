import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ContractTemplate,
  ContractTemplateDocument,
} from '../schemas/contract-template.schema';
import {
  ArticleSection,
  getDefaultArticles,
} from '../constants/default-templates';
import { ContractType } from '../schemas/contract.schema';

@Injectable()
export class ContractTemplateService {
  constructor(
    @InjectModel(ContractTemplate.name)
    private model: Model<ContractTemplateDocument>,
  ) {}

  /** Returns full article list, applying any DB overrides + per-contract overrides. */
  async getArticles(
    contractType: ContractType,
    perContractOverrides: Record<string, string> = {},
  ): Promise<ArticleSection[]> {
    const defaults = getDefaultArticles(contractType);
    const dbDoc = await this.model.findOne({ contractType }).lean();
    const dbOverrides: Record<string, string> = (dbDoc?.articles ?? {}) as any;

    return defaults.map((art) => ({
      ...art,
      body:
        perContractOverrides?.[art.key] ??
        dbOverrides[art.key] ??
        art.body,
    }));
  }

  async list() {
    return this.model.find().lean();
  }

  async getByType(contractType: ContractType) {
    const doc = await this.model.findOne({ contractType }).lean();
    if (!doc) {
      // Return synthetic doc from defaults
      return {
        contractType,
        articles: {},
        variables: [],
      };
    }
    return doc;
  }

  async upsert(
    contractType: ContractType,
    articles: Record<string, string>,
    lastEditedBy?: string,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { contractType },
        { $set: { articles, lastEditedBy } },
        { new: true, upsert: true },
      )
      .lean();
    if (!doc) throw new NotFoundException('Template not found');
    return doc;
  }

  async resetToDefault(contractType: ContractType) {
    await this.model.deleteOne({ contractType });
    return { success: true };
  }
}
