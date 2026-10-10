'use client';

import Image from "next/image";
import {usePathname} from "next/navigation";
import RollText from "@/components/RollText";
import {marketFromPathname, type Department} from "@/lib/markets";

// The Local section, and Local team members everywhere, carry the LMIT wordmark; the rest of the app carries GMIT's.
// Both use the same mark and lettering.
const TeamLogo = ({ department }: { department?: Department }) => {
    const pathname = usePathname();
    const local = marketFromPathname(pathname) === 'local' || department === 'local';
    const team = local ? 'LMIT' : 'GMIT';

    return (
        <>
            <Image src="/assets/icons/gmit-mark.svg" alt="" width={28} height={31} className="h-[26px] w-auto" priority />
            <RollText className="h-4">
                <Image src={`/assets/icons/${team.toLowerCase()}-wordmark.svg`} alt={`${team} Portfolio`} width={local ? 143 : 149} height={19} className="block h-4 w-auto" priority />
            </RollText>
        </>
    );
};

export default TeamLogo
