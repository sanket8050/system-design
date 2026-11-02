import { strict as assert } from 'assert';

// REST API contract validation helpers

interface ApiError {
  code: string;
  message: string;
  details?: { field: string; issue: string }[];
  requestId?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor?: string;
    hasNextPage: boolean;
    total?: number;
  };
}

function validateApiError(response: unknown): ApiError {
  const r = response as Record<string, unknown>;
  if (!r.error || typeof (r.error as Record<string, unknown>).code !== 'string') {
    throw new Error('Invalid error response format');
  }
  return (r as { error: ApiError }).error;
}

function encodeCursor(id: number): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

function decodeCursor(cursor: string): { id: number } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
}

function paginateItems<T extends { id: number }>(
  items: T[],
  cursor: string | undefined,
  limit: number
): PaginatedResponse<T> {
  const afterId = cursor ? decodeCursor(cursor).id : 0;
  const filtered = items.filter(i => i.id > afterId);
  const page = filtered.slice(0, limit);
  const hasNextPage = filtered.length > limit;
  const nextCursor = hasNextPage ? encodeCursor(page[page.length - 1].id) : undefined;

  return { data: page, meta: { nextCursor, hasNextPage, total: items.length } };
}

// Tests
const errorPayload = { error: { code: 'NOT_FOUND', message: 'User not found', requestId: 'req_1' } };
const err = validateApiError(errorPayload);
assert.equal(err.code, 'NOT_FOUND');

const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
const page1 = paginateItems(items, undefined, 10);
assert.equal(page1.data.length, 10);
assert(page1.meta.hasNextPage);
assert(page1.meta.nextCursor);

const page2 = paginateItems(items, page1.meta.nextCursor, 10);
assert.equal(page2.data[0].id, 11);

const page3 = paginateItems(items, page2.meta.nextCursor, 10);
assert(!page3.meta.hasNextPage);

console.log('REST API design and pagination tests passed');
