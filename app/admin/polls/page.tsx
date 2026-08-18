import type { Metadata } from 'next';
import { CheckCircle2, PlayCircle, Users, Vote } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { PollEditor, PollStatusButtons } from '@/app/admin/polls/poll-editor';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Progress } from '@/components/ui/misc';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, toDateTimeInputValue } from '@/lib/utils';
import { closeElapsedPolls, pollWithResultsInclude, tallyPoll } from '@/services/community-service';

export const metadata: Metadata = { title: 'Polls' };

export default async function AdminPollsPage() {
  await requireRole('ADMIN');
  await closeElapsedPolls();

  const [polls, residentCount] = await Promise.all([
    prisma.poll.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: 'asc' }, { endsAt: 'desc' }],
      include: pollWithResultsInclude,
    }),
    prisma.residentProfile.count({ where: { deletedAt: null } }),
  ]);

  const active = polls.filter((poll) => poll.status === 'ACTIVE').length;
  const closed = polls.filter((poll) => poll.status === 'CLOSED').length;
  const totalVotes = polls.reduce((sum, poll) => sum + poll._count.votes, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Community polls"
        description="Put society decisions to a vote. Each resident may vote once per poll."
        actions={<PollEditor />}
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active polls" value={active} icon={PlayCircle} tone="success" />
        <StatCard label="Closed polls" value={closed} icon={CheckCircle2} />
        <StatCard label="Votes cast" value={totalVotes} icon={Vote} tone="info" />
        <StatCard label="Eligible voters" value={residentCount} icon={Users} />
      </section>

      {polls.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No polls yet"
          description="Create a poll to gather resident opinion on a society decision."
        />
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const tally = tallyPoll(poll);
            const turnout = residentCount > 0 ? Math.round((tally.total / residentCount) * 100) : 0;

            return (
              <Card key={poll.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{poll.title}</CardTitle>
                        <StatusBadge status={poll.status} />
                        {poll.showLiveResults ? <Badge variant="outline">Live results</Badge> : null}
                        {poll.isAnonymous ? <Badge variant="muted">Anonymous</Badge> : null}
                      </div>
                      {poll.description ? (
                        <CardDescription className="mt-1.5">{poll.description}</CardDescription>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(poll.startsAt)} → {formatDateTime(poll.endsAt)}
                        {poll.author ? ` · created by ${poll.author.fullName}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <PollEditor
                        poll={{
                          id: poll.id,
                          title: poll.title,
                          description: poll.description,
                          options: poll.options.map((option) => option.label),
                          startsAt: toDateTimeInputValue(poll.startsAt),
                          endsAt: toDateTimeInputValue(poll.endsAt),
                          isAnonymous: poll.isAnonymous,
                          showLiveResults: poll.showLiveResults,
                          status: poll.status,
                          voteCount: poll._count.votes,
                        }}
                      />
                      <PollStatusButtons pollId={poll.id} status={poll.status} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {tally.total} vote{tally.total === 1 ? '' : 's'} · {turnout}% turnout
                    </span>
                  </div>

                  {tally.results.map((result) => (
                    <div key={result.optionId}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">{result.label}</span>
                        <span className="tabular shrink-0 text-muted-foreground">
                          {result.percent}% · {result.votes}
                        </span>
                      </div>
                      <Progress value={result.percent} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
