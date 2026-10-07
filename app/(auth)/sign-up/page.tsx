'use client';

import {useEffect, useMemo, useState} from "react";
import {useForm, useWatch} from "react-hook-form";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import {INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS} from "@/lib/constants";
import {departmentForExecutive, DEPARTMENT_OPTIONS, ROLE_OPTIONS} from "@/lib/markets";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import {getFilledExecutiveRoles, signUpWithEmail} from "@/lib/actions/auth.actions";
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
            preferredIndustry: 'Technology'
        },
        mode: 'onBlur'
    });

    // Executive portfolio manager seats that are already taken aren't offered
    const [filledExecutives, setFilledExecutives] = useState<TeamRole[]>([]);
    useEffect(() => {
        getFilledExecutiveRoles().then(setFilledExecutives).catch(() => setFilledExecutives([]));
    }, []);

    const department = useWatch({ control, name: 'department' });
    const roleOptions = useMemo(() => ROLE_OPTIONS.filter((role) => {
        const executiveOf = departmentForExecutive(role.value);
        if (!executiveOf) return true;
        if (filledExecutives.includes(role.value)) return false;
        // Only the chosen department's executive role is offered
        return !department || executiveOf === department;
    }), [department, filledExecutives]);

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
                    options={DEPARTMENT_OPTIONS}
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

                <Button type="submit" disabled={isSubmitting} className="blue-btn w-full mt-5">
                    {isSubmitting ? 'Creating Account' : 'Start Your Investing Journey'}
                </Button>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    )
}
export default SignUp;
