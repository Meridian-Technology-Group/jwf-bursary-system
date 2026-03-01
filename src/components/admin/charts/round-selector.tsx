"use client";

/**
 * Round selector dropdown for the reports page.
 *
 * Updates the page URL via search params when a different round is selected,
 * causing the server component to re-render with the new round's data.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

interface RoundOption {
  id: string;
  academicYear: string;
}

interface RoundSelectorProps {
  rounds: RoundOption[];
  selectedRoundId: string;
}

export function RoundSelector({ rounds, selectedRoundId }: RoundSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("roundId", e.target.value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="round-selector"
        className="text-sm font-medium text-slate-600 whitespace-nowrap"
      >
        Assessment round:
      </label>
      <select
        id="round-selector"
        value={selectedRoundId}
        onChange={handleChange}
        className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600"
      >
        {rounds.map((round) => (
          <option key={round.id} value={round.id}>
            {round.academicYear}
          </option>
        ))}
      </select>
    </div>
  );
}
