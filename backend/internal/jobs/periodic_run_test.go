package jobs

import (
	"context"
	"testing"
	"time"
)

// How long a test waits before giving up on something that should have happened. It is a limit for a
// failing test and never a delay for a passing one, since every wait ends as soon as the thing happens.
const waitLimit = 5 * time.Second

// An interval too long to pass during a test, so only the first run can happen
const neverInterval = time.Hour

// A very short interval, so several runs happen quickly
const quickInterval = 5 * time.Millisecond

// Actions
// A job that does nothing but say it ran, and the channel it says so on
func countingJob() (func(context.Context), chan struct{}) {
	calls := make(chan struct{}, 1000)
	return func(context.Context) { calls <- struct{}{} }, calls
}

func waitForCalls(t *testing.T, calls chan struct{}, count int) {
	t.Helper()
	for received := 0; received < count; received++ {
		select {
		case <-calls:
		case <-time.After(waitLimit):
			t.Fatalf("expected %d runs of the job, got only %d", count, received)
		}
	}
}

// Starts RunEvery and gives back a channel that closes when it returns
func startRunEvery(ctx context.Context, interval time.Duration, job func(context.Context)) chan struct{} {
	finished := make(chan struct{})
	go func() {
		RunEvery(ctx, interval, job)
		close(finished)
	}()
	return finished
}

func waitUntilFinished(t *testing.T, finished chan struct{}) {
	t.Helper()
	select {
	case <-finished:
	case <-time.After(waitLimit):
		t.Fatal("RunEvery did not return")
	}
}

func TestRunEvery_RunsTheJobStraightAway(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	job, calls := countingJob()
	finished := startRunEvery(ctx, neverInterval, job)

	waitForCalls(t, calls, 1)

	cancel()
	waitUntilFinished(t, finished)
}

func TestRunEvery_RunsAgainAfterEveryInterval(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	job, calls := countingJob()
	finished := startRunEvery(ctx, quickInterval, job)

	waitForCalls(t, calls, 4)

	cancel()
	waitUntilFinished(t, finished)
}

func TestRunEvery_StopsWhenTheContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	job, calls := countingJob()
	finished := startRunEvery(ctx, quickInterval, job)
	waitForCalls(t, calls, 1)

	cancel()

	waitUntilFinished(t, finished)
}

func TestRunEvery_DoesNothingWhenTheContextIsAlreadyCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	job, calls := countingJob()

	finished := startRunEvery(ctx, quickInterval, job)

	waitUntilFinished(t, finished)
	if ran := len(calls); ran != 0 {
		t.Errorf("the job should not run once the context is cancelled, but it ran %d times", ran)
	}
}
