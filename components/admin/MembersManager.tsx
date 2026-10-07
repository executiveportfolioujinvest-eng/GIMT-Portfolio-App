'use client';

import {useEffect, useMemo, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {useForm, useWatch, type Control, type UseFormGetValues, type UseFormSetValue} from "react-hook-form";
import {toast} from "sonner";
import {ExternalLink, Pencil, Trash2} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import {addMember, removeMember, updateMemberAccess} from "@/lib/actions/admin.actions";
import {DEPARTMENT_OPTIONS, departmentLabel, isAdminRole, isLeadershipRole, ROLE_OPTIONS, roleFitsDepartment, roleLabel} from "@/lib/markets";

type AccessValues = { department: Department; teamRole: TeamRole };
type NewMemberValues = AccessValues & { name: string; email: string; password: string };
type Department = MemberView['department'];

const DIALOG = "bg-gray-800 border-gray-600 text-gray-400 sm:max-w-lg rounded-2xl p-6 sm:p-10";
const OUTLINE_BTN = "h-auto rounded border border-gray-600 bg-transparent px-3 py-2 text-sm text-gray-100 hover:bg-gray-700";
const COLUMNS = ['Name', 'Email', 'Department', 'Role', 'Joined', 'Actions'];

// Department, then the roles that fit it (single seats someone else holds are left out)
const AccessFields = <T extends AccessValues>({ control, getValues, setValue, takenSeats }: {
    control: Control<T>;
    getValues: UseFormGetValues<T>;
    setValue: UseFormSetValue<T>;
    takenSeats: TeamRole[];
}) => {
    const c = control as unknown as Control<AccessValues>;
    const department = useWatch({ control: c, name: 'department' });
    const roleOptions = useMemo(
        () => ROLE_OPTIONS.filter((r) => !takenSeats.includes(r.value) && (!department || roleFitsDepartment(r.value, department))),
        [department, takenSeats]
    );

    useEffect(() => {
        const get = getValues as unknown as UseFormGetValues<AccessValues>;
        const set = setValue as unknown as UseFormSetValue<AccessValues>;
        const current = get('teamRole');
        if (current && !roleOptions.some((r) => r.value === current)) set('teamRole', '' as TeamRole);
    }, [roleOptions, getValues, setValue]);

    return (
        <>
            <SelectField name="department" label="Department" placeholder="Select a department" options={DEPARTMENT_OPTIONS} control={c} required />
            <SelectField name="teamRole" label="Role" placeholder="Select a role" options={roleOptions} control={c} required />
        </>
    );
};

// The administrator's Members tab: add, re-assign and remove analysts and managers
const MembersManager = ({ members }: { members: MemberView[] }) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<MemberView | null>(null);
    const [removing, setRemoving] = useState<MemberView | null>(null);

    // Single seats held by someone (other than the member being edited)
    const takenSeats = (exceptId?: string) =>
        members.filter((m) => m.id !== exceptId && isLeadershipRole(m.teamRole)).map((m) => m.teamRole as TeamRole);

    const addForm = useForm<NewMemberValues>({
        defaultValues: { name: '', email: '', password: '', department: '' as Department, teamRole: '' as TeamRole },
    });
    const editForm = useForm<AccessValues>({ defaultValues: { department: 'global', teamRole: '' as TeamRole } });

    const openEdit = (member: MemberView) => {
        editForm.reset({ department: member.department, teamRole: member.teamRole ?? ('' as TeamRole) });
        setEditing(member);
    };

    const done = (ok: boolean, title: string, error?: string) => {
        if (!ok) toast.error(title, { description: error });
        router.refresh();
        return ok;
    };

    const onAdd = (values: NewMemberValues) => startTransition(async () => {
        const result = await addMember(values);
        if (!done(result.success, 'Member not added', result.success ? undefined : result.error)) return;
        toast.success(`${values.name} added`, { description: `They can sign in with ${values.email} and the password you set.` });
        addForm.reset();
        setAdding(false);
    });

    const onEdit = (values: AccessValues) => startTransition(async () => {
        if (!editing) return;
        const result = await updateMemberAccess(editing.id, values);
        if (!done(result.success, 'Member not updated', result.success ? undefined : result.error)) return;
        toast.success(`${editing.name} is now ${roleLabel(values.teamRole)}`);
        setEditing(null);
    });

    const onRemove = () => startTransition(async () => {
        if (!removing) return;
        const result = await removeMember(removing.id);
        if (!done(result.success, 'Member not removed', result.success ? undefined : result.error)) return;
        toast.success(`${removing.name} removed`);
        setRemoving(null);
    });

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="watchlist-title">Members</h2>
                    <p className="mt-1 text-sm text-gray-400">{members.length} account{members.length === 1 ? '' : 's'} across both departments</p>
                </div>
                <Button type="button" className="search-btn" onClick={() => setAdding(true)}>Add Member</Button>
            </div>

            <Table className="watchlist-table">
                <TableHeader>
                    <TableRow className="table-header-row">
                        {COLUMNS.map((label) => <TableHead key={label} className="table-header h-14 text-base text-gray-400">{label}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((m) => {
                        const admin = isAdminRole(m.teamRole);
                        return (
                            <TableRow key={m.id} className="table-row h-16 cursor-default">
                                <TableCell className="table-cell pl-4">
                                    <span className="flex items-center gap-2">
                                        <span className="max-w-48 truncate">{m.name}</span>
                                        {m.linkedinUrl && (
                                            <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`} className="text-gray-500 hover:text-blue-400">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        )}
                                    </span>
                                </TableCell>
                                <TableCell className="table-cell">{m.email}</TableCell>
                                <TableCell className="table-cell">{admin ? 'Both' : departmentLabel(m.department).replace(' Department', '')}</TableCell>
                                <TableCell className="table-cell">{roleLabel(m.teamRole)}</TableCell>
                                <TableCell className="table-cell">
                                    {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                </TableCell>
                                <TableCell className="table-cell">
                                    {admin ? (
                                        <span className="text-sm text-gray-500">Managed by executives</span>
                                    ) : (
                                        <span className="flex gap-2">
                                            <Button type="button" className={OUTLINE_BTN} aria-label={`Change ${m.name}'s role`} onClick={() => openEdit(m)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" className={OUTLINE_BTN} aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <Dialog open={adding} onOpenChange={setAdding}>
                <DialogContent className={DIALOG}>
                    <DialogHeader>
                        <DialogTitle className="alert-title text-2xl font-bold">Add Member</DialogTitle>
                        <DialogDescription className="text-gray-500">
                            Creates the account with a password you share with them. Their background can be added later.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-5">
                        <InputField name="name" label="Full Name" placeholder="John Doe" register={addForm.register} error={addForm.formState.errors.name}
                            validation={{ required: 'Name is required', minLength: { value: 2, message: 'Enter a name' } }} />
                        <InputField name="email" label="Email" placeholder="name@example.com" register={addForm.register} error={addForm.formState.errors.email}
                            validation={{ required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } }} />
                        <InputField name="password" label="Password" type="password" placeholder="At least 8 characters" register={addForm.register} error={addForm.formState.errors.password}
                            validation={{ required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } }} />
                        <AccessFields control={addForm.control} getValues={addForm.getValues} setValue={addForm.setValue} takenSeats={takenSeats()} />
                        <Button type="submit" disabled={isPending} className="blue-btn w-full mt-5">{isPending ? 'Adding...' : 'Add Member'}</Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
                <DialogContent className={DIALOG}>
                    <DialogHeader>
                        <DialogTitle className="alert-title text-2xl font-bold">Change Role</DialogTitle>
                        <DialogDescription className="text-gray-500">{editing?.name} ({editing?.email})</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-5">
                        <AccessFields control={editForm.control} getValues={editForm.getValues} setValue={editForm.setValue} takenSeats={takenSeats(editing?.id)} />
                        <Button type="submit" disabled={isPending} className="blue-btn w-full mt-5">{isPending ? 'Saving...' : 'Save'}</Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
                <DialogContent className={DIALOG}>
                    <DialogHeader>
                        <DialogTitle className="alert-title text-2xl font-bold">Remove Member</DialogTitle>
                        <DialogDescription className="text-gray-500">
                            {removing?.name} ({removing?.email}) will be signed out and their account, watchlist and alerts deleted.
                            Their open portfolio requests are cancelled; signed history stays. This can&apos;t be undone.
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

export default MembersManager;
