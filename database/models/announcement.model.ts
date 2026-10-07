import { Schema, model, models, type Document, type Model } from 'mongoose';

// A notice an administrator posts to the top of a department's dashboard (or both), also emailed to its members
export interface AnnouncementItem extends Document {
  audience: 'global' | 'local' | 'both';
  title: string;
  message: string;
  postedBy: { id: string; name: string };
  emailedTo: number;
  createdAt: Date;
}

const AnnouncementSchema = new Schema<AnnouncementItem>(
  {
    audience: { type: String, enum: ['global', 'local', 'both'], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    postedBy: { type: new Schema({ id: String, name: String }, { _id: false }), required: true },
    emailedTo: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const Announcement: Model<AnnouncementItem> =
  (models?.Announcement as Model<AnnouncementItem>) || model<AnnouncementItem>('Announcement', AnnouncementSchema);
