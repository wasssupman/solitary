import { NextResponse } from 'next/server';

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO_OWNER = 'wasssupman';
const REPO_NAME = 'solitaire-wassup';
const WORKFLOW_FILE = 'agent-create-mode.yml';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 },
      );
    }

    const requestId = crypto.randomUUID();

    // Trigger workflow_dispatch
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            prompt: prompt.trim(),
            request_id: requestId,
          },
        }),
      },
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      console.error('GitHub dispatch failed:', dispatchRes.status, text);
      return NextResponse.json(
        { error: 'Failed to trigger workflow' },
        { status: 502 },
      );
    }

    // Wait briefly for the run to appear
    await new Promise((r) => setTimeout(r, 3000));

    // Find the workflow run
    const runsRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5&event=workflow_dispatch`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!runsRes.ok) {
      return NextResponse.json(
        { requestId, runId: null, message: 'Workflow triggered but could not fetch run ID' },
        { status: 202 },
      );
    }

    const runsData = await runsRes.json();
    const run = runsData.workflow_runs?.find(
      (r: { status: string }) => r.status === 'queued' || r.status === 'in_progress',
    );

    return NextResponse.json({
      requestId,
      runId: run?.id ?? null,
      htmlUrl: run?.html_url ?? null,
      status: run?.status ?? 'triggered',
    });
  } catch (err) {
    console.error('Agent run error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
