/**
 * F-042 — Audit script: List ALL contracts có generatedDocuments[] để identify
 * affected contracts cần regenerate sau khi F-042 template fix deploy.
 *
 * Per BR-42-11. Read-only — NO DB mutation.
 *
 * Run:
 *   cd backend && npx ts-node scripts/audit-contract-docx-templates.ts [--deploy-ts=2026-05-18T00:00:00Z]
 *
 * Output: backend/scripts/audit-f042-report.json
 *
 * Schema per contract row:
 *   {
 *     contractId, contractNumber, contractType, status,
 *     generatedDocuments: [
 *       { docType, generatedAt, s3Key, format, version, needsRegen: boolean }
 *     ],
 *     paymentRequestPaid: boolean,  // F-042 safeguard flag (Manager Adjustment)
 *   }
 *
 * `needsRegen=true` if generatedAt < F-042 deploy timestamp + docType != PAYMENT_REQUEST
 * (PAYMENT_REQUEST template was clean per BA audit, no regen needed).
 */
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/modules/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Contract } from '../src/modules/contracts/schemas/contract.schema';
import { Model } from 'mongoose';

interface AuditEntry {
  contractId: string;
  contractNumber: string;
  contractType: string;
  status: string;
  generatedDocuments: Array<{
    docType: string;
    generatedAt: string;
    s3Key: string;
    format: string;
    version: number;
    needsRegen: boolean;
  }>;
  paymentRequestPaid: boolean;
}

interface AuditReport {
  generatedAt: string;
  deployTimestamp: string;
  summary: {
    totalContracts: number;
    contractsNeedingRegen: number;
    docCounts: Record<string, number>; // per docType
    paidContractsAffected: number; // F-042 safeguard count
  };
  contracts: AuditEntry[];
}

async function main() {
  const args = process.argv.slice(2);
  const deployTsArg = args.find((a) => a.startsWith('--deploy-ts='));
  const deployTs = deployTsArg
    ? deployTsArg.split('=')[1]
    : '2026-05-18T00:00:00Z';
  const deployDate = new Date(deployTs);

  console.log(`F-042 Audit — deploy timestamp: ${deployDate.toISOString()}`);
  console.log('='.repeat(70));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const contractModel = app.get<Model<Contract>>(getModelToken(Contract.name));

  // Query contracts có ít nhất 1 generatedDocument
  const contracts = await contractModel
    .find({
      'generatedDocuments.0': { $exists: true },
      deletedAt: null,
    })
    .lean();

  console.log(`Found ${contracts.length} contracts with generated documents`);

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    deployTimestamp: deployTs,
    summary: {
      totalContracts: contracts.length,
      contractsNeedingRegen: 0,
      docCounts: {},
      paidContractsAffected: 0,
    },
    contracts: [],
  };

  for (const c of contracts) {
    const paymentRequestPaid = c.paymentRequest?.status === 'PAID';
    const docs = (c.generatedDocuments ?? []).map((g) => {
      const generatedAt = g.generatedAt ? new Date(g.generatedAt) : new Date(0);
      // F-042 needsRegen: doc generated BEFORE F-042 fix deploy AND docType != PAYMENT_REQUEST
      // (PAYMENT_REQUEST template clean per BA audit)
      const needsRegen =
        generatedAt < deployDate && g.docType !== 'PAYMENT_REQUEST';
      report.summary.docCounts[g.docType] =
        (report.summary.docCounts[g.docType] ?? 0) + 1;
      return {
        docType: g.docType,
        generatedAt: generatedAt.toISOString(),
        s3Key: g.s3Key,
        format: g.format,
        version: g.version,
        needsRegen,
      };
    });

    const entry: AuditEntry = {
      contractId: String(c._id),
      contractNumber: c.contractNumber ?? '(unset)',
      contractType: c.contractType ?? '(unknown)',
      status: c.status ?? '(unknown)',
      generatedDocuments: docs,
      paymentRequestPaid,
    };

    const hasRegen = docs.some((d) => d.needsRegen);
    if (hasRegen) {
      report.summary.contractsNeedingRegen += 1;
      if (paymentRequestPaid) {
        report.summary.paidContractsAffected += 1;
      }
    }

    report.contracts.push(entry);
  }

  const outPath = path.join(__dirname, 'audit-f042-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log('Summary:');
  console.log(`  Total contracts with generated docs: ${report.summary.totalContracts}`);
  console.log(`  Contracts needing regen: ${report.summary.contractsNeedingRegen}`);
  console.log(`  PAID contracts affected (safeguard flag): ${report.summary.paidContractsAffected}`);
  console.log(`  Document count by type:`);
  for (const [docType, count] of Object.entries(report.summary.docCounts)) {
    console.log(`    ${docType}: ${count}`);
  }
  console.log('');
  console.log(`✅ Report written: ${outPath}`);

  await app.close();
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
