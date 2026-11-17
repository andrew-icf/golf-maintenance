package jobs

import (
	"context"
	"time"
)

// RunEvery runs the job once straight away and then again every interval, until the context is
// cancelled. It does nothing at all when the context is already cancelled. interval must be above
// zero. It blocks, so the server starts it with go.
func RunEvery(ctx context.Context, interval time.Duration, job func(context.Context)) {
	if ctx.Err() != nil {
		return
	}
	job(ctx)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			job(ctx)
		}
	}
}
