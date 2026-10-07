import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketKey } from '@/lib/markets';
import type { CollectionPhase, CompanySnapshot, FinancialPeriod, PeerSnapshot, ReportDocument } from '@/lib/valuation/types';

// Everything collected for one company's Valuation tab: the reported figures by period (from SEC filings,
// the company's own results documents and Yahoo Finance), market data, peers and collection progress.
// Only extracted numbers are stored, never the documents themselves.
export interface CompanyFinancialsData {
  key: string;
  market: MarketKey;
  symbol: string;
  company: string;
  phase: CollectionPhase;
  status: 'collecting' | 'ready' | 'failed';
  message?: string;
  periods: FinancialPeriod[];
  snapshot?: CompanySnapshot;
  peers: PeerSnapshot[];
  documents: ReportDocument[];
  documentAttempts: Record<string, number>;
  websiteNote?: string;
  secCik?: string;
  leaseUntil?: Date;
  requestedBy?: { id: string; name: string };
  collectedAt?: Date;
  updatedAt: Date;
}

export interface CompanyFinancialsItem extends Document, Omit<CompanyFinancialsData, never> {}

const CompanyFinancialsSchema = new Schema<CompanyFinancialsItem>(
  {
    key: { type: String, required: true, unique: true },
    market: { type: String, enum: ['global', 'local'], required: true },
    symbol: { type: String, required: true, uppercase: true },
    company: { type: String, default: '' },
    phase: { type: String, enum: ['basics', 'discover', 'read', 'done'], default: 'basics' },
    status: { type: String, enum: ['collecting', 'ready', 'failed'], default: 'collecting' },
    message: String,
    periods: { type: Schema.Types.Mixed, default: [] },
    snapshot: Schema.Types.Mixed,
    peers: { type: Schema.Types.Mixed, default: [] },
    documents: { type: Schema.Types.Mixed, default: [] },
    documentAttempts: { type: Schema.Types.Mixed, default: {} },
    websiteNote: String,
    secCik: String,
    leaseUntil: Date,
    requestedBy: { type: new Schema({ id: String, name: String }, { _id: false }) },
    collectedAt: Date,
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, minimize: false }
);

export const CompanyFinancials: Model<CompanyFinancialsItem> =
  (models?.CompanyFinancials as Model<CompanyFinancialsItem>) || model<CompanyFinancialsItem>('CompanyFinancials', CompanyFinancialsSchema);
