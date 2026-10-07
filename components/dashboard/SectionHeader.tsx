import Link from "next/link";

const SectionHeader = ({ title, href, action }: { title: string; href?: string; action?: React.ReactNode }) => (
    <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="dash-section-title">{title}</h2>
        {href ? <Link href={href} className="dash-view-all">View all</Link> : action}
    </div>
);

export default SectionHeader;
