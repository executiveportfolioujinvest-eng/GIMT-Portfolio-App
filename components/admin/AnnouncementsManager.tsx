'use client';

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import {toast} from "sonner";
import {Megaphone, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import TextareaField from "@/components/forms/TextareaField";
import {deleteAnnouncement, postAnnouncement} from "@/lib/actions/admin.actions";

type AnnouncementValues = { audience: AnnouncementView['audience']; title: string; message: string };

const AUDIENCE_OPTIONS = [
    { value: 'global', label: 'Global Markets Department' },
    { value: 'local', label: 'Local Markets Department' },
    { value: 'both', label: 'Both departments' },
];
const audienceLabel = (value: string) => AUDIENCE_OPTIONS.find((o) => o.value === value)?.label ?? value;

// The administrator's Announcements tab: post to the dashboards (and members' inboxes) and take posts down
const AnnouncementsManager = ({ announcements }: { announcements: AnnouncementView[] }) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [removingId, setRemovingId] = useState<string | null>(null);
    const { register, control, handleSubmit, reset, formState: { errors } } = useForm<AnnouncementValues>({
        defaultValues: { audience: 'both', title: '', message: '' },
    });

    const onPost = (values: AnnouncementValues) => startTransition(async () => {
        const result = await postAnnouncement(values);
        if (!result.success) {
            toast.error('Not posted', { description: result.error });
            return;
        }
        toast.success('Announcement posted', { description: result.message });
        reset({ audience: values.audience, title: '', message: '' });
        router.refresh();
    });

    const onDelete = (id: string) => {
        setRemovingId(id);
        startTransition(async () => {
            const result = await deleteAnnouncement(id);
            setRemovingId(null);
            if (!result.success) {
                toast.error('Not removed', { description: result.error });
                return;
            }
            toast.success('Announcement removed from the dashboards');
            router.refresh();
        });
    };

    return (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <section className="dash-panel flex flex-col gap-4">
                <div>
                    <h2 className="watchlist-title">New Announcement</h2>
                    <p className="mt-1 text-sm text-gray-400">Shows at the top of the chosen dashboards and is emailed to every member of those departments.</p>
                </div>
                <form onSubmit={handleSubmit(onPost)} className="space-y-5">
                    <SelectField name="audience" label="Post to" placeholder="Choose the departments" options={AUDIENCE_OPTIONS} control={control} error={errors.audience} required />
                    <InputField name="title" label="Title" placeholder="eg: Committee meeting moved to Thursday" register={register} error={errors.title}
                        validation={{ required: 'Title is required', maxLength: { value: 120, message: 'Keep it under 120 characters' } }} />
                    <TextareaField name="message" label="Message" placeholder="What everyone needs to know" register={register} error={errors.message} rows={5} maxLength={2000}
                        validation={{ required: 'Message is required', validate: (v) => !!String(v).trim() || 'Message is required' }} />
                    <Button type="submit" disabled={isPending} className="blue-btn w-full">{isPending && !removingId ? 'Posting and emailing...' : 'Post and email'}</Button>
                </form>
            </section>

            <section className="flex flex-col gap-4">
                <h2 className="watchlist-title">Posted</h2>
                {announcements.length === 0 ? (
                    <div className="dash-panel py-10 text-center">
                        <p className="empty-title">No announcements</p>
                        <p className="empty-description mx-auto">Posts appear here and on the dashboards until you remove them.</p>
                    </div>
                ) : announcements.map((a) => (
                    <article key={a.id} className="dash-panel flex gap-4">
                        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-100">{a.title}</h3>
                            <p className="mt-1 whitespace-pre-line text-sm text-gray-400">{a.message}</p>
                            <p className="mt-2 text-xs text-gray-500">
                                {audienceLabel(a.audience)} &bull; {a.postedBy} &bull;{' '}
                                {new Date(a.createdAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' })} &bull;{' '}
                                emailed to {a.emailedTo}
                            </p>
                        </div>
                        <Button type="button" disabled={isPending} aria-label={`Remove ${a.title}`} onClick={() => onDelete(a.id)}
                            className="h-10 w-10 shrink-0 rounded border border-gray-600 bg-transparent p-0 text-gray-400 hover:bg-gray-700 hover:text-red-400">
                            <Trash2 className="mx-auto h-4 w-4" />
                        </Button>
                    </article>
                ))}
            </section>
        </div>
    );
};

export default AnnouncementsManager;
