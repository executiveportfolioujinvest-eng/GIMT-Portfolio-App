import {cn} from "@/lib/utils";

// Two stacked copies of the content; the navbar CSS slides the stack up on hover
const RollText = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    return (
        <span className={cn("roll", className)}>
            <span className="roll-track">
                <span className="roll-item">{children}</span>
                <span className="roll-item" aria-hidden="true">{children}</span>
            </span>
        </span>
    )
}

export const NavLinkContent = ({ label }: { label: string }) => (
    <>
        <span className="nav-fill" aria-hidden="true" />
        <RollText>{label}</RollText>
    </>
)

export default RollText
