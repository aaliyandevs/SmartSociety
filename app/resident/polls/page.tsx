import type { Metadata } from 'next';
import { Vote } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { PollCard } from '@/app/resident/polls/poll-card';
import { EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import {
  closeElapsedPolls,
  pollResultsVisible,
  pollWithResultsInclude,
  tallyPoll,
} from '@/services/community-service';

export const metadata: Metadata = { title: 'Polls & Voting' };

export default async function ResidentPollsPage() {
  const user = await requireResident();
  await closeElapsedPolls();

  const now = new Date();

  const [polls, myVotes] = await Promise.all([
    prisma.poll.findMany({
      // Drafts are never exposed to residents.
      where: { deletedAt: null, status: { in: ['ACTIVE', 'CLOSED'] } },
      orderBy: [{ status: 'asc' }, { endsAt: 'desc' }],
      include: pollWithResultsInclude,
    }),
    prisma.pollVote.findMany({
      where: { residentId: user.residentId },
      select: { pollId: true, optionId: true },
    }),
  ]);

  const voteByPoll = new Map(myVotes.map((vote) => [vote.pollId, vote.optionId]));

  const open = polls.filter(
    (poll) => poll.status === 'ACTIVE' && poll.startsAt <= now && poll.endsAt > now,
  );
  const closed = polls.filter((poll) => !open.includes(poll));

  function render(list: typeof polls) {
    if (list.length === 0) {
      return (
        <EmptyState
          icon={Vote}
          title="Nothing here"
          description="Community polls published by the managing committee will appear here."
        />
      );
    }

    return (
      <div className="space-y-4">
        {list.map((poll) => {
          const tally = tallyPoll(poll);
          const votedOptionId = voteByPoll.get(poll.id) ?? null;
          return (
            <PollCard
              key={poll.id}
              poll={{
                id: poll.id,
                title: poll.title,
                description: poll.description,
                status: poll.status,
                startsAt: poll.startsAt.toISOString(),
                endsAt: poll.endsAt.toISOString(),
                isAnonymous: poll.isAnonymous,
                authorName: poll.author?.fullName ?? null,
              }}
              options={poll.options.map((option) => ({ id: option.id, label: option.label }))}
              results={tally.results}
              totalVotes={tally.total}
              votedOptionId={votedOptionId}
              // Live tallies are hidden until the poll closes unless the
              // committee explicitly enabled them.
              showResults={pollResultsVisible(poll) || votedOptionId !== null}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Polls & voting"
        description="Have your say on society decisions. Each resident may vote once per poll."
      />

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="closed">Results ({closed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open">{render(open)}</TabsContent>
        <TabsContent value="closed">{render(closed)}</TabsContent>
      </Tabs>
    </div>
  );
}
