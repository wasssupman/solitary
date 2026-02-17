import { NextResponse } from 'next/server';

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO_OWNER = 'wasssupman';
const REPO_NAME = 'solitaire-wassup';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;

    if (!runId || isNaN(Number(runId))) {
      return NextResponse.json(
        { error: 'Valid runId is required' },
        { status: 400 },
      );
    }

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
        },
        next: { revalidate: 0 },
      },
    );

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'Run not found' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch run status' },
        { status: 502 },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      status: data.status,
      conclusion: data.conclusion,
      htmlUrl: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (err) {
    console.error('Agent status error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
