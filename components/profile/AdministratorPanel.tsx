'use client';

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import {toast} from "sonner";
import {ShieldCheck, Trash2} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import {createAdministrator, enterAdminMode, removeAdministrator} from "@/lib/actions/profile.actions";

type NewAdmin = { name: string; email: string; password: string };

const DIALOG = "bg-gray-800 border-gray-600 text-gray-400 sm:max-w-lg rounded-2xl p-6 sm:p-10";
const OUTLINE_BTN = "h-auto rounded border border-gray-600 bg-transparent px-3 py-2 text-sm text-gray-100 hover:bg-gray-700";

// Executive PMs, the President and Vice President add administrator accounts here and sign into them
const AdministratorPanel = ({ administrators }: { administrators: AdministratorView[] }) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [adding, setAdding] = useState(false);
    const [entering, setEntering] = useState<AdministratorView | null>(null);
    const [removing, setRemoving] = useState<AdministratorView | null>(null);
    const [password, setPassword] = useState('');

    const addForm = useForm<NewAdmin>({ defaultValues: { name: '', email: '', password: '' } });

    const onAdd = (values: NewAdmin) => startTransition(async () => {
        const result = await createAdministrator(values);
        if (!result.success) {
            toast.error('Administrator not added', { description: result.error });
            return;
        }
        toast.success('Administrator added', { description: `${values.email} can now sign in, or you can enter administrator mode below.` });
        addForm.reset();
        setAdding(false);
        router.refresh();
    });

    const onEnter = () => startTransition(async () => {
        if (!entering) return;
        const result = await enterAdminMode({ adminId: entering.id, password });
        setPassword('');
        if (!result.success) {
            toast.error('Couldn’t enter administrator mode', { description: result.error });
            return;
        }
        router.push(result.home ?? '/admin');
        router.refresh();
    });

    const onRemove = () => startTransition(async () => {
        if (!removing) return;
        const result = await removeAdministrator(removing.id);
        if (!result.success) {
            toast.error('Administrator not removed', { description: result.error });
            return;
        }
        toast.success(`${removing.name} removed`);
        setRemoving(null);
        router.refresh();
    });

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="watchlist-title">Administrator Mode</h2>
                    <p className="mt-1 text-sm text-gray-400">
                        Administrator accounts manage members, the dashboards and announcements for both departments.
                        Enter one with its password; &ldquo;Exit administrator mode&rdquo; in the account menu brings you back here.
                    </p>
                </div>
                <Button type="button" className="search-btn" onClick={() => setAdding(true)}>Add Administrator</Button>
            </div>

            {administrators.length === 0 ? (
                <div className="dash-panel py-10 text-center">
                    <p className="empty-title">No administrator accounts yet</p>
                    <p className="empty-description mx-auto">Add one with its own email and password, then enter administrator mode from here.</p>
                </div>
            ) : (
                <ul className="flex flex-col gap-3">
                    {administrators.map((admin) => (
                        <li key={admin.id} className="dash-panel flex flex-wrap items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <ShieldCheck className="h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-gray-100">{admin.name}</p>
                                    <p className="truncate text-sm text-gray-400">
                                        {admin.email}{admin.addedBy ? ` • added by ${admin.addedBy}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" className="search-btn" onClick={() => { setPassword(''); setEntering(admin); }}>
                                    Enter administrator mode
                                </Button>
                                <Button type="button" className={OUTLINE_BTN} aria-label={`Remove ${admin.name}`} onClick={() => setRemoving(admin)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Dialog open={adding} onOpenChange={setAdding}>
                <DialogContent className={DIALOG}>
                    <DialogHeader>
                        <DialogTitle className="alert-title text-2xl font-bold">Add Administrator</DialogTitle>
                        <DialogDescription className="text-gray-500">
                            The account gets its own email and password. It never appears on the sign-up page.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-5">
                        <InputField name="name" label="Name" placeholder="eg: GMIT Admin" register={addForm.register} error={addForm.formState.errors.name}
                            validation={{ required: 'Name is required', minLength: { value: 2, message: 'Enter a name' } }} />
                        <InputField name="email" label="Email" placeholder="admin@example.com" register={addForm.register} error={addForm.formState.errors.email}
                            validation={{ required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } }} />
                        <InputField name="password" label="Password" type="password" placeholder="At least 8 characters" register={addForm.register} error={addForm.formState.errors.password}
                            validation={{ required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } }} />
                        <Button type="submit" disabled={isPending} className="blue-btn w-full mt-5">
                            {isPending ? 'Adding...' : 'Add Administrator'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!entering} onOpenChange={(open) => { if (!open) setEntering(null); }}>
                <DialogContent className={DIALOG}>
                    <DialogHeader>
                        <DialogTitle className="alert-title text-2xl font-bold">Enter Administrator Mode</DialogTitle>
                        <DialogDescription className="text-gray-500">
                            Sign in as {entering?.name} ({entering?.email}). Your own account stays signed in for when you exit.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); onEnter(); }} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="admin-password" className="form-label">Administrator password</label>
                            <input id="admin-password" type="password" autoComplete="current-password" value={password}
                                onChange={(e) => setPassword(e.target.value)} className="form-input w-full rounded-lg border" />
                        </div>
                        <Button type="submit" disabled={isPending || !password} className="blue-btn w-full mt-5">
                            {isPending ? 'Signing in...' : 'Enter administrator mode'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
                <DialogContent className={DIALOG}>
                    <DialogHeader>
                        <DialogTitle className="alert-title text-2xl font-bold">Remove Administrator</DialogTitle>
                        <DialogDescription className="text-gray-500">
                            {removing?.name} ({removing?.email}) will be signed out and the account deleted. This can&apos;t be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3">
                        <Button type="button" className={OUTLINE_BTN} onClick={() => setRemoving(null)}>Cancel</Button>
                        <Button type="button" disabled={isPending} className="watchlist-btn watchlist-remove h-11 w-auto px-5" onClick={onRemove}>
                            {isPending ? 'Removing...' : 'Remove'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
};

export default AdministratorPanel;
