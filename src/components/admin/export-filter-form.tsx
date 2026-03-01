"use client";

/**
 * ExportFilterForm — client component that manages round, school, and format
 * selections and delegates to ExportButton for the actual download trigger.
 *
 * Rendered as a Card with three controls:
 *  1. Round selector (populated from server props)
 *  2. School filter (optional)
 *  3. Format toggle (XLSX / CSV)
 *  4. Download button
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ExportButton } from "@/components/admin/export-button";

interface Round {
  id: string;
  academicYear: string;
  status: string;
}

interface ExportFilterFormProps {
  rounds: Round[];
}

const SCHOOL_OPTIONS = [
  { value: "", label: "All Schools" },
  { value: "TRINITY", label: "Trinity" },
  { value: "WHITGIFT", label: "Whitgift" },
] as const;

const FORMAT_OPTIONS = [
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "csv", label: "CSV" },
] as const;

export function ExportFilterForm({ rounds }: ExportFilterFormProps) {
  const [roundId, setRoundId] = useState<string>(rounds[0]?.id ?? "");
  const [school, setSchool] = useState<string>("");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Download Options</CardTitle>
        <CardDescription>
          Select a round and optional filters, then click Download.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Round selector */}
        <div className="space-y-1.5">
          <Label htmlFor="round-select">Assessment Round</Label>
          {rounds.length === 0 ? (
            <p className="text-sm text-slate-400">
              No rounds available. Create a round first.
            </p>
          ) : (
            <Select value={roundId} onValueChange={setRoundId}>
              <SelectTrigger id="round-select" className="w-full">
                <SelectValue placeholder="Select a round" />
              </SelectTrigger>
              <SelectContent>
                {rounds.map((round) => (
                  <SelectItem key={round.id} value={round.id}>
                    {round.academicYear}
                    <span className="ml-2 text-xs text-slate-400">
                      ({round.status})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* School filter */}
        <div className="space-y-1.5">
          <Label htmlFor="school-select">School Filter</Label>
          <Select value={school} onValueChange={setSchool}>
            <SelectTrigger id="school-select" className="w-full">
              <SelectValue placeholder="All Schools" />
            </SelectTrigger>
            <SelectContent>
              {SCHOOL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Format toggle */}
        <div className="space-y-1.5">
          <Label htmlFor="format-select">File Format</Label>
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as "xlsx" | "csv")}
          >
            <SelectTrigger id="format-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Download */}
        <div className="pt-2">
          <ExportButton
            roundId={roundId}
            school={school || undefined}
            format={format}
          />
        </div>
      </CardContent>
    </Card>
  );
}
