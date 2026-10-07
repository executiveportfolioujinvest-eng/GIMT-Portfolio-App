import { Schema, model, models, type Document, type Model } from 'mongoose';

type Person = { id: string; name: string; role?: string };

// One change made in administrator mode (or to an administrator account), for the executives, President and
// Vice President to review on their profile pages
export interface AdminActivityItem extends Document {
  action: string;
  summary: string;
  // The administrator account the change was made with
  admin?: Person;
  // The person behind it: the portfolio manager who entered administrator mode; empty when someone
  // signed straight into the administrator account
  actor?: Person;
  at: Date;
}

const PersonSchema = new Schema({ id: String, name: String, role: String }, { _id: false });

const AdminActivitySchema = new Schema<AdminActivityItem>(
  {
    action: { type: String, required: true },
    summary: { type: String, required: true },
    admin: { type: PersonSchema },
    actor: { type: PersonSchema },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AdminActivity: Model<AdminActivityItem> =
  (models?.AdminActivity as Model<AdminActivityItem>) || model<AdminActivityItem>('AdminActivity', AdminActivitySchema);
