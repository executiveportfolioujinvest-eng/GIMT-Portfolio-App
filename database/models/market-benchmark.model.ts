import { Schema, model, models, type Document, type Model } from 'mongoose';

// Market-wide figures the valuation compares companies with (bond yield, market growth, dividend ranges),
// recalculated at most once a day per department's market
export interface MarketBenchmarkItem extends Document {
  market: 'global' | 'local';
  data: Record<string, unknown>;
  updatedAt: Date;
}

const MarketBenchmarkSchema = new Schema<MarketBenchmarkItem>(
  {
    market: { type: String, enum: ['global', 'local'], required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const MarketBenchmark: Model<MarketBenchmarkItem> =
  (models?.MarketBenchmark as Model<MarketBenchmarkItem>) || model<MarketBenchmarkItem>('MarketBenchmark', MarketBenchmarkSchema);
