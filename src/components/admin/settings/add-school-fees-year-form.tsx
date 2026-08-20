"use client";

/**
 * Add a school's annual fee for an academic year — Epic 15 M2 (CH-17).
 *
 * School + academic year + pre-VAT amount. The year choice becomes
 * effectiveFrom = 1 September of the start year (the fee-year resolver's
 * anchor). Adding a year that already exists updates it (same upsert).
 */

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertSchoolFeesAction } from "@/app/(admin)/settings/actions";
import {
  academicYearLabel,
  academicYearStartDate,
  academicYearStartFor,
} from "@/lib/schools/academic-year";

const SCHOOLS = [
  { value: "TRINITY", label: "Trinity School" },
  { value: "WHITGIFT", label: "Whitgift School" },
] as const;

export function AddSchoolFeesYearForm() {
  const [school, setSchool] = React.useState<string>("");
  const [startYear, setStartYear] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Offer last year → +2 (covers a late back-entry and forward planning).
  const currentStart = academicYearStartFor(new Date());
  const yearOptions = [-1, 0, 1, 2].map((offset) => currentStart + offset);

  function handleAdd() {
    setError(null);
    const parsed = parseFloat(amount);
    if (!school || !startYear || isNaN(parsed) || parsed < 0) {
      setError("Pick a school and academic year, and enter the annual fee.");
      return;
    }
    const fd = new FormData();
    fd.set("school", school);
    fd.set("annualFees", amount);
    fd.set(
      "effectiveFrom",
      academicYearStartDate(parseInt(startYear, 10)).toISOString().slice(0, 10)
    );
    startTransition(async () => {
      const result = await upsertSchoolFeesAction(fd);
      if (result.success) {
        setSchool("");
        setStartYear("");
        setAmount("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">School</p>
        <Select value={school} onValueChange={setSchool} disabled={isPending}>
          <SelectTrigger className="h-8 w-44 text-sm" aria-label="School">
            <SelectValue placeholder="Select school" />
          </SelectTrigger>
          <SelectContent>
            {SCHOOLS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Academic year</p>
        <Select value={startYear} onValueChange={setStartYear} disabled={isPending}>
          <SelectTrigger className="h-8 w-32 text-sm" aria-label="Academic year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {academicYearLabel(y)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">
          Annual fee (before VAT)
        </p>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 w-36 pl-6 text-sm"
            aria-label="Annual fee before VAT"
            disabled={isPending}
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={isPending}
        className="h-8 gap-1 bg-primary-800 text-xs hover:bg-primary-700"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-3 w-3" aria-hidden="true" />
        )}
        Add year
      </Button>
      {error && (
        <p className="w-full text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
