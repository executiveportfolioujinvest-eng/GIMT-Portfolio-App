import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { LocalStock, MarketKey, SummaryTab } from '@/lib/markets';

// What a department's dashboard shows, as set by an administrator. Missing lists fall back to the built-in defaults.
export interface DashboardSettingsItem extends Document {
  market: MarketKey;
  hiddenSections: string[];
  summaryTabs?: SummaryTab[];
  topStocks?: string[];
  localStocks?: LocalStock[];
  updatedBy?: { id: string; name: string; at: Date };
}

const DashboardSettingsSchema = new Schema<DashboardSettingsItem>(
  {
    market: { type: String, enum: ['global', 'local'], required: true, unique: true },
    hiddenSections: { type: [String], default: [] },
    summaryTabs: {
      type: [new Schema({
        label: String,
        symbols: [new Schema({ symbol: String, label: String, badge: String }, { _id: false })],
      }, { _id: false })],
      default: undefined,
    },
    topStocks: { type: [String], default: undefined },
    localStocks: {
      type: [new Schema({ symbol: String, name: String, sector: String }, { _id: false })],
      default: undefined,
    },
    updatedBy: { type: new Schema({ id: String, name: String, at: Date }, { _id: false }) },
  },
  { timestamps: false }
);

export const DashboardSettings: Model<DashboardSettingsItem> =
  (models?.DashboardSettings as Model<DashboardSettingsItem>) || model<DashboardSettingsItem>('DashboardSettings', DashboardSettingsSchema);
