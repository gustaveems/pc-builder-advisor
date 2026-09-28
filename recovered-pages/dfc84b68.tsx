"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Check, X, Clock, Loader2 } from "lucide-react";
import Link from "next/link";

interface Submission {
  id: string;
  status: "pending" | "approved" | "rejected";
  category: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: Record<string, any>;
  submitted_by: string;
  submitted_at: string;
  reviewed_at?: string;
  review_note?: string;
}

type FilterStatus = "all" | "pending" | "approved" | "rejected";

export default function ReviewSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/admin/submissions"
          : `/api/admin/submissions?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        setSubmissions(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  async function handleAction(id: string, action: "approved" | "rejected") {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchSubmissions();
      }
    } finally {
      setActioningId(null);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      approved:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      rejected:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || ""}`}
      >
        {status === "pending" && <Clock className="h-3 w-3" />}
        {status === "approved" && <Check className="h-3 w-3" />}
        {status === "rejected" && <X className="h-3 w-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/build"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Builder
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Submissions</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Approve or reject community-submitted components.
          </p>
        </div>
        <Button as="link" href="/admin/submit-component" variant="outline" size="sm">
          Submit New
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex gap-2">
        {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === s
                  ? "bg-foreground text-background"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Submissions list */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading submissions...
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 py-12 text-center text-zinc-500">
            No {filter !== "all" ? filter : ""} submissions found.
          </div>
        ) : (
          submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold truncate">{sub.name}</h3>
                    {statusBadge(sub.status)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="capitalize">{sub.category}</span>
                    <span>{sub.manufacturer}</span>
                    {sub.price_usd && <span>${sub.price_usd}</span>}
                    <span>by {sub.submitted_by}</span>
                    <span>
                      {new Date(sub.submitted_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Specs preview */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(sub.specs)
                      .slice(0, 6)
                      .map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs"
                        >
                          <span className="text-zinc-500 dark:text-zinc-400 mr-1">
                            {key}:
                          </span>
                          {String(val)}
                        </span>
                      ))}
                  </div>
                </div>

                {sub.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(sub.id, "approved")}
                      disabled={actioningId === sub.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(sub.id, "rejected")}
                      disabled={actioningId === sub.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
