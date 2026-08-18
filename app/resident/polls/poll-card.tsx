'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Lock, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Progress } from '@/components/ui/misc';
import { SubmitButton, useActionFeedback } from '@/components/shared/form';
import { voteAction } from '@/actions/community-actions';
import { idleState } from '@/lib/action-result';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

interface PollView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  isAnonymous: boolean;
  authorName: string | null;
}

interface ResultView {
  optionId: string;
  label: string;
  votes: number;
  percent: number;
}

export function PollCard({
  poll,
  options,
  results,
  totalVotes,
  votedOptionId,
  showResults,
}: {
  poll: PollView;
  options: { id: string; label: string }[];
  results: ResultView[];
  totalVotes: number;
  votedOptionId: string | null;
  showResults: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(voteAction, idleState);
  const [choice, setChoice] = React.useState<string | null>(votedOptionId);

  useActionFeedback(state, { onSuccess: () => router.refresh() });

  const isOpen = poll.status === 'ACTIVE' && new Date(poll.endsAt) > new Date();
  const hasVoted = votedOptionId !== null;
  const winner = results.reduce<ResultView | null>(
    (best, result) => (!best || result.votes > best.votes ? result : best),
    null,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{poll.title}</CardTitle>
            {poll.description ? (
              <CardDescription className="mt-1.5">{poll.description}</CardDescription>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasVoted ? (
              <Badge variant="success">
                <CheckCircle2 className="size-3" />
                Voted
              </Badge>
            ) : null}
            <Badge variant={isOpen ? 'soft' : 'muted'}>{isOpen ? 'Open' : 'Closed'}</Badge>
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {totalVotes} vote{totalVotes === 1 ? '' : 's'}
          </span>
          <span>
            {isOpen
              ? `Closes ${formatRelative(poll.endsAt)}`
              : `Closed ${formatDateTime(poll.endsAt)}`}
          </span>
          {poll.isAnonymous ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3.5" aria-hidden />
              Anonymous
            </span>
          ) : null}
          {poll.authorName ? <span>Posted by {poll.authorName}</span> : null}
        </p>
      </CardHeader>

      <CardContent>
        {showResults || !isOpen ? (
          <div className="space-y-3">
            {results.map((result) => {
              const isMine = result.optionId === votedOptionId;
              const isWinner = !isOpen && winner?.optionId === result.optionId && result.votes > 0;
              return (
                <div key={result.optionId}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className={cn('min-w-0', (isMine || isWinner) && 'font-medium')}>
                      {result.label}
                      {isMine ? (
                        <Badge variant="success" className="ml-2">
                          Your vote
                        </Badge>
                      ) : null}
                      {isWinner ? (
                        <Badge variant="soft" className="ml-2">
                          Leading
                        </Badge>
                      ) : null}
                    </span>
                    <span className="tabular shrink-0 text-muted-foreground">
                      {result.percent}% · {result.votes}
                    </span>
                  </div>
                  <Progress
                    value={result.percent}
                    indicatorClassName={isMine ? 'bg-success' : undefined}
                  />
                </div>
              );
            })}

            {isOpen && !hasVoted ? (
              <Alert variant="info" className="mt-4">
                Results are shown live for this poll. You can still cast your vote below.
              </Alert>
            ) : null}
          </div>
        ) : null}

        {isOpen && !hasVoted ? (
          <form action={formAction} className={cn('space-y-3', showResults && 'mt-5 border-t border-border pt-5')}>
            <input type="hidden" name="pollId" value={poll.id} />
            <input type="hidden" name="optionId" value={choice ?? ''} />

            {state.status === 'error' ? (
              <Alert variant="destructive" title="Could not record your vote">
                {state.message}
              </Alert>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="sr-only">Choose an option</legend>
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setChoice(option.id)}
                  aria-pressed={choice === option.id}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                    choice === option.id
                      ? 'border-primary bg-primary-soft'
                      : 'border-border hover:bg-accent/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4.5 shrink-0 items-center justify-center rounded-full border',
                      choice === option.id ? 'border-primary' : 'border-input',
                    )}
                    aria-hidden
                  >
                    {choice === option.id ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                  </span>
                  {option.label}
                </button>
              ))}
            </fieldset>

            <div className="flex justify-end">
              <SubmitButton disabled={!choice}>Cast my vote</SubmitButton>
            </div>
          </form>
        ) : null}

        {isOpen && hasVoted && !showResults ? (
          <Alert variant="success">
            Your vote has been recorded. Results will be published when the poll closes.
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
