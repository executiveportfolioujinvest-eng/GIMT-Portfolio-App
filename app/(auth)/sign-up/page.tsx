'use client';

import {useEffect, useMemo, useState} from "react";
import {Controller, useFieldArray, useForm, useWatch} from "react-hook-form";
import {Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import TextareaField from "@/components/forms/TextareaField";
import UniversitySelect from "@/components/forms/UniversitySelect";
import BirthdayPicker from "@/components/forms/BirthdayPicker";
import {INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS} from "@/lib/constants";
import {DEPARTMENT_OPTIONS, OVERSIGHT_ROLES, ROLE_OPTIONS, roleFitsDepartment} from "@/lib/markets";
import {emptyEducation, GOAL_MAX_LENGTH, MAX_EDUCATION_ENTRIES, normalizeLinkedInUrl, YEAR_OF_STUDY_OPTIONS} from "@/lib/member-profile";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import {getFilledLeadershipRoles, signUpWithEmail} from "@/lib/actions/auth.actions";
import {useRouter} from "next/navigation";
import {toast} from "sonner";

const SignUp = () => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        control,
        getValues,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            department: '' as SignUpFormData['department'],
            teamRole: '' as TeamRole,
            country: 'US',
            investmentGoals: 'Growth',
            riskTolerance: 'Medium',
            preferredIndustry: 'Technology',
            birthday: '',
            education: [emptyEducation()],
            careerGoals: '',
            yearGoals: '',
            learningGoals: '',
            linkedinUrl: '',
        },
        mode: 'onBlur'
    });

    // Members can list every degree they've studied, e.g. an undergraduate elsewhere and honours at UJ
    const { fields: educationFields, append: addEducation, remove: removeEducation } = useFieldArray({ control, name: 'education' });

    // Executive and deputy portfolio manager seats that are already taken aren't offered
    const [filledSeats, setFilledSeats] = useState<TeamRole[]>([]);
    useEffect(() => {
        getFilledLeadershipRoles().then(setFilledSeats).catch(() => setFilledSeats([]));
    }, []);

    const department = useWatch({ control, name: 'department' });
    const roleOptions = useMemo(() => ROLE_OPTIONS.filter((role) => {
        if (filledSeats.includes(role.value)) return false;
        // Only the roles that belong to the chosen department are offered ('both' is the President and Vice President)
        return !department || roleFitsDepartment(role.value, department);
    }), [department, filledSeats]);

    // "Both Portfolios" disappears once the President and Vice President are both in place
    const departmentOptions = useMemo(
        () => DEPARTMENT_OPTIONS.filter((d) => d.value !== 'both' || OVERSIGHT_ROLES.some((role) => !filledSeats.includes(role))),
        [filledSeats]
    );

    // Clear a role that no longer fits after the department changes
    useEffect(() => {
        const current = getValues('teamRole');
        if (current && !roleOptions.some((r) => r.value === current)) setValue('teamRole', '' as TeamRole);
    }, [roleOptions, getValues, setValue]);

    const onSubmit = async (data: SignUpFormData) => {
        try {
            const result = await signUpWithEmail(data);
            if(result.success) return router.push(result.home ?? '/');
            toast.error('Sign up failed', { description: result.error ?? 'Failed to create an account.' });
        } catch (e) {
            console.error(e);
            toast.error('Sign up failed', {
                description: e instanceof Error ? e.message : 'Failed to create an account.'
            })
        }
    }

    return (
        <>
            <h1 className="form-title">Sign Up & Personalize</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="fullName"
                    label="Full Name"
                    placeholder="John Doe"
                    register={register}
                    error={errors.fullName}
                    validation={{ required: 'Full name is required', minLength: 2 }}
                />

                <InputField
                    name="email"
                    label="Email"
                    placeholder="Enter your email"
                    register={register}
                    error={errors.email}
                    validation={{ required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } }}
                />

                <SelectField
                    name="department"
                    label="Department"
                    placeholder="Which portfolio are you part of?"
                    options={departmentOptions}
                    control={control}
                    error={errors.department}
                    required
                />

                <SelectField
                    name="teamRole"
                    label="Role"
                    placeholder="Select your role"
                    options={roleOptions}
                    control={control}
                    error={errors.teamRole}
                    required
                />

                <InputField
                    name="password"
                    label="Password"
                    placeholder="Enter a strong password"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: 'Password is required', minLength: 8 }}
                />

                <CountrySelectField
                    name="country"
                    label="Country"
                    control={control}
                    error={errors.country}
                    required
                />

                <SelectField
                    name="investmentGoals"
                    label="Investment Goals"
                    placeholder="Select your investment goal"
                    options={INVESTMENT_GOALS}
                    control={control}
                    error={errors.investmentGoals}
                    required
                />

                <SelectField
                    name="riskTolerance"
                    label="Risk Tolerance"
                    placeholder="Select your risk level"
                    options={RISK_TOLERANCE_OPTIONS}
                    control={control}
                    error={errors.riskTolerance}
                    required
                />

                <SelectField
                    name="preferredIndustry"
                    label="Preferred Industry"
                    placeholder="Select your preferred industry"
                    options={PREFERRED_INDUSTRIES}
                    control={control}
                    error={errors.preferredIndustry}
                    required
                />

                <div className="space-y-1 border-t border-gray-600 pt-6">
                    <h2 className="text-xl font-bold text-gray-400">Your Background</h2>
                    <p className="text-sm text-gray-500">Shared with your portfolio managers.</p>
                </div>

                {educationFields.map((item, index) => (
                    <div key={item.id} className="space-y-4 rounded-lg border border-gray-600 p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-400">
                                {educationFields.length > 1 ? `Education ${index + 1}` : 'Education'}
                            </h3>
                            {educationFields.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeEducation(index)}
                                    className="flex cursor-pointer items-center gap-1 text-sm text-gray-500 transition-colors hover:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" /> Remove
                                </button>
                            )}
                        </div>

                        <InputField
                            name={`education.${index}.degree`}
                            label="Degree"
                            placeholder="eg: BCom Investment Management"
                            register={register}
                            error={errors.education?.[index]?.degree}
                            validation={{ required: 'Degree is required', maxLength: { value: 120, message: 'Keep the degree under 120 characters' } }}
                        />

                        <div className="space-y-2">
                            <Label htmlFor={`education.${index}.institution`} className="form-label">University</Label>
                            <Controller
                                name={`education.${index}.institution`}
                                control={control}
                                rules={{ required: 'Please select your university' }}
                                render={({ field }) => (
                                    <UniversitySelect
                                        id={field.name}
                                        value={field.value}
                                        country={getValues(`education.${index}.institutionCountry`)}
                                        onSelect={(name, country) => {
                                            setValue(`education.${index}.institutionCountry`, country);
                                            field.onChange(name);
                                        }}
                                    />
                                )}
                            />
                            {errors.education?.[index]?.institution && (
                                <p className="text-sm text-red-500">{errors.education[index].institution.message}</p>
                            )}
                        </div>

                        <SelectField
                            name={`education.${index}.yearOfStudy`}
                            label="Year of Study"
                            placeholder="Select your current year of study"
                            options={YEAR_OF_STUDY_OPTIONS}
                            control={control}
                            error={errors.education?.[index]?.yearOfStudy}
                            required
                        />
                    </div>
                ))}

                {educationFields.length < MAX_EDUCATION_ENTRIES && (
                    <button
                        type="button"
                        onClick={() => addEducation(emptyEducation())}
                        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 text-gray-400 transition-colors hover:border-blue-500 hover:text-blue-400"
                    >
                        <Plus className="h-4 w-4" /> Add another education
                    </button>
                )}

                <TextareaField
                    name="careerGoals"
                    label="Career Goals"
                    placeholder="Where do you see your career heading?"
                    register={register}
                    error={errors.careerGoals}
                    maxLength={GOAL_MAX_LENGTH}
                    validation={{ required: 'Tell us your career goals', validate: (v) => !!String(v).trim() || 'Tell us your career goals' }}
                />

                <TextareaField
                    name="yearGoals"
                    label="Goals for This Year"
                    placeholder="What do you want to achieve this year?"
                    register={register}
                    error={errors.yearGoals}
                    maxLength={GOAL_MAX_LENGTH}
                    validation={{ required: 'Tell us your goals for this year', validate: (v) => !!String(v).trim() || 'Tell us your goals for this year' }}
                />

                <TextareaField
                    name="learningGoals"
                    label="What would you like to learn from this experience?"
                    placeholder="Skills, markets or ways of working you want to develop"
                    register={register}
                    error={errors.learningGoals}
                    maxLength={GOAL_MAX_LENGTH}
                    validation={{ required: 'Tell us what you would like to learn', validate: (v) => !!String(v).trim() || 'Tell us what you would like to learn' }}
                />

                <div className="space-y-2">
                    <Label htmlFor="birthday" className="form-label">Birthday</Label>
                    <Controller
                        name="birthday"
                        control={control}
                        rules={{ validate: (v) => /^\d{2}-\d{2}$/.test(v ?? '') || 'Select your birthday (month and day)' }}
                        render={({ field }) => <BirthdayPicker id="birthday" value={field.value} onChange={field.onChange} />}
                    />
                    {errors.birthday && <p className="text-sm text-red-500">{errors.birthday.message}</p>}
                    <p className="text-xs text-gray-500">So the team can wish you a happy birthday. Only the day and month are kept.</p>
                </div>

                <InputField
                    name="linkedinUrl"
                    label="LinkedIn Profile"
                    placeholder="https://www.linkedin.com/in/your-name"
                    register={register}
                    error={errors.linkedinUrl}
                    validation={{
                        required: 'LinkedIn profile is required',
                        validate: (v) => !!normalizeLinkedInUrl(v) || 'Enter your LinkedIn profile link, e.g. https://www.linkedin.com/in/your-name',
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="blue-btn w-full mt-5">
                    {isSubmitting ? 'Creating Account' : 'Start Your Investing Journey'}
                </Button>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    )
}
export default SignUp;
