import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketKey } from '@/lib/markets';

// A position in a department's shared team portfolio
export interface TeamHoldingItem extends Document {
  market: MarketKey;
  symbol: string;
  company: string;
  shares: number;
  buyPrice: number;
  addedAt: Date;
  updatedAt: Date;
}

const TeamHoldingSchema = new Schema<TeamHoldingItem>(
  {
    market: { type: String, enum: ['global', 'local'], required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    shares: { type: Number, required: true, min: 0 },
    buyPrice: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// One position per stock per department; buying more averages the cost
TeamHoldingSchema.index({ market: 1, symbol: 1 }, { unique: true });

export const TeamHolding: Model<TeamHoldingItem> =
  (models?.TeamHolding as Model<TeamHoldingItem>) || model<TeamHoldingItem>('TeamHolding', TeamHoldingSchema);
