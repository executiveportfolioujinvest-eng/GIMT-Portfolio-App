import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketKey } from '@/lib/markets';

export interface HoldingItem extends Document {
  userId: string;
  market: MarketKey;
  symbol: string;
  company: string;
  shares: number;
  buyPrice: number;
  addedAt: Date;
}

const HoldingSchema = new Schema<HoldingItem>(
  {
    userId: { type: String, required: true, index: true },
    market: { type: String, enum: ['global', 'local'], default: 'global', index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    shares: { type: Number, required: true, min: 0 },
    buyPrice: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// One position per stock; buying more updates the share count and average price
HoldingSchema.index({ userId: 1, market: 1, symbol: 1 }, { unique: true });

export const Holding: Model<HoldingItem> =
  (models?.Holding as Model<HoldingItem>) || model<HoldingItem>('Holding', HoldingSchema);
