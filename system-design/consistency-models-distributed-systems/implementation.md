# Practical Example: Blog Post Publication

Let's consider a distributed blog platform where users can publish posts and other users (or the same user) can view them. We'll explore how different consistency models impact the user experience and system design.

## Scenario: Publishing a Blog Post

A user (Alice) writes a new blog post and clicks "Publish". The post data needs to be stored and then become visible to readers globally. Our system has multiple nodes (replicas) across different regions.

### Data Model (Simplified)

```typescript
interface BlogPost {
  id: string;
  authorId: string;
  title: string;
  content: string;
  publishedAt: Date;
  version: number; // Used for optimistic concurrency / tracking updates
}
```

## Approach 1: Strong Consistency (Linearizability)

**Goal:** Once Alice publishes her post, anyone (including Alice) immediately sees it upon refresh. No stale reads are possible.

**How it works:**
*   **Write Operation (`publishPost`):**
    1.  The write request is sent to a primary node (or a quorum leader).
    2.  The primary node ensures the write is committed and successfully replicated to a majority of other replicas (e.g., using Paxos or Raft consensus).
    3.  Only after this quorum acknowledgment, the primary responds `OK` to Alice.
*   **Read Operation (`getPost` / `getLatestPosts`):**
    1.  Any read request can be served by any replica.
    2.  Before serving, the replica ensures it has the absolute latest committed state (potentially by consulting the primary or a majority of other replicas for the latest version/timestamp).
    3.  Alternatively, reads are always routed through the primary or a leader that guarantees up-to-dateness.

**Conceptual Flow:**

```typescript
// On the server side (simplified)
async function publishPostStrongly(post: BlogPost): Promise<void> {
  // 1. Acquire distributed lock or coordinate with consensus leader (e.g., Raft leader)
  // 2. Write to primary storage.
  // 3. Replicate to a quorum of replicas.
  // 4. Await successful replication acknowledgements.
  // 5. Release lock / update leader state.
  console.log(`[Node X] Post '${post.title}' committed and replicated to quorum.`);
  return; // Only returns after full consistency for this operation.
}

async function getPostStrongly(postId: string): Promise<BlogPost> {
  // 1. Query any replica.
  // 2. Replica internally ensures it has the latest committed data for this postId
  //    (e.g., by checking a global version number, or forwarding to primary if necessary).
  const post = await database.readLatest(postId);
  console.log(`[Node Y] Read post '${post.title}' (version ${post.version}) - guaranteed latest.`);
  return post;
}
```

**User Experience:** Alice publishes. She refreshes. She *always* sees her new post. No confusion.

**Trade-offs:**
*   **Pros:** Simple application logic, highly predictable.
*   **Cons:** High latency for writes (waiting for quorum), reduced availability during network partitions or node failures (if quorum cannot be formed), complex underlying infrastructure.

---

## Approach 2: Eventual Consistency (with Read-your-writes)

**Goal:** Alice publishes her post. She might not see it immediately if she refreshes from a different node, but we want to guarantee she sees *her own* writes if possible. Other users might see stale data for a short period.

**How it works:**
*   **Write Operation (`publishPost`):**
    1.  The write request is sent to a primary node (or any available node).
    2.  The node commits the write locally and immediately responds `OK` to Alice.
    3.  Asynchronous replication starts in the background to other replicas.
*   **Read Operation (`getPost` / `getLatestPosts`):**
    1.  Read requests are served by any available replica.
    2.  Replicas serve whatever data they currently have, which might be stale.
*   **Achieving "Read-your-writes":**
    *   **Method A (Sticky Sessions):** After Alice writes, subsequent reads from her session are always routed to the same node she wrote to, or a node known to be up-to-date with her write.
    *   **Method B (Version Tokens):** The write operation returns a "version token" (e.g., a timestamp, a unique ID from the written node). Subsequent read requests from Alice include this token, and the system ensures the read is served by a replica that has processed at least that version.

**Conceptual Flow:**

```typescript
// On the server side (simplified)
async function publishPostEventually(post: BlogPost): Promise<{ postId: string, versionToken?: string }> {
  // 1. Write to local storage / primary node.
  // 2. Immediately respond to client.
  // 3. Asynchronously replicate to other nodes.
  const postId = await database.write(post);
  const versionToken = generateVersionToken(post); // e.g., timestamp, or node ID + latest sequence
  console.log(`[Node A] Post '${post.title}' written locally. Async replication started.`);
  return { postId, versionToken }; // Return token for read-your-writes
}

async function getPostEventually(postId: string, userVersionToken?: string): Promise<BlogPost | null> {
  // 1. Query any available replica.
  // 2. If userVersionToken is provided, attempt to route to an up-to-date replica
  //    or wait briefly for local replica to catch up to that version.
  const post = await database.read(postId, userVersionToken);
  if (post) {
    console.log(`[Node B] Read post '${post.title}' (version ${post.version}) - may be stale.`);
  } else {
    console.log(`[Node B] Post '${postId}' not found or still replicating.`);
  }
  return post;
}
```

**User Experience:**
*   Alice publishes. The system immediately says "Post published!".
*   Alice refreshes:
    *   If her request hits the same node she wrote to (or one that has replicated quickly), she sees her post.
    *   If her request hits a different, not-yet-replicated node, she might *not* see her post immediately. This can be confusing.
*   **With Read-your-writes:** If the client sends the `versionToken` received from `publishPostEventually`, the system tries harder to ensure she sees her post on subsequent reads. Other users, however, might still not see it until replication completes.

## Conclusion

The choice of consistency model is a fundamental design decision. For a blog platform:
*   **Strong Consistency:** Great for user experience (always consistent), but very expensive at scale, especially globally.
*   **Eventual Consistency (with Read-your-writes/Monotonic Reads):** More practical for global scale. Users might experience brief inconsistencies, but careful design (e.g., sticky sessions, version tokens, UI feedback) can mitigate the impact for critical user flows. For a blog, a few seconds or even minutes of eventual consistency for a new post is often acceptable, especially for other users.
