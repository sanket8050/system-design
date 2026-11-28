# Sliding Window Counter (SWC) Algorithm

The Sliding Window Log (SWL) algorithm, while accurate, can be memory-intensive. For each `(user, API_endpoint)` combination, it stores every request's timestamp in a Redis Sorted Set. If you have millions of users making frequent requests, these sorted sets can grow very large.

The **Sliding Window Counter (SWC)** algorithm offers a more memory-efficient alternative, though it introduces a slight approximation.

## How it Works

Instead of storing individual timestamps, SWC tracks two counters:

1.  **Current Window Counter:** Tracks requests within the current fixed time window (e.g., `[now - windowSize, now]`).
2.  **Previous Window Counter:** Tracks requests within the *previous* fixed time window (e.g., `[now - 2*windowSize, now - windowSize]`).

Let's say your `windowSize` is 1 minute and `limit` is 100 requests.

When a request comes in at `T`:

1.  Determine the current fixed window (e.g., if `T` is 10:30:15, the current window is `[10:30:00, 10:31:00)`).
2.  Determine the previous fixed window (e.g., `[10:29:00, 10:30:00)`).
3.  Increment the counter for the **current fixed window**.
4.  Calculate the count for the *effective* sliding window `[T - windowSize, T]`:
    *   `count_current_window = requests_in_current_fixed_window`
    *   `count_previous_window = requests_in_previous_fixed_window`
    *   `overlap_percentage = (time_into_current_fixed_window) / windowSize`
    *   `estimated_sliding_window_count = count_current_window + (count_previous_window * (1 - overlap_percentage))`
5.  If `estimated_sliding_window_count <= limit`, allow the request. Otherwise, block.

## Example

*   Limit: 100 requests / minute
*   Current time: 10:30:15 (15 seconds into the 10:30-10:31 window)
*   Requests in `[10:30:00, 10:31:00)` (current fixed window): 20
*   Requests in `[10:29:00, 10:30:00)` (previous fixed window): 90

`overlap_percentage = 15s / 60s = 0.25`

`estimated_sliding_window_count = 20 + (90 * (1 - 0.25)) = 20 + (90 * 0.75) = 20 + 67.5 = 87.5`

Since `87.5 <= 100`, the request is allowed.

## Pros & Cons

**Pros:**
*   **Memory Efficient:** Only needs two counters per key, regardless of request volume.
*   **Decent Accuracy:** Provides a good approximation of the true sliding window.

**Cons:**
*   **Approximation:** Not perfectly accurate. Spikes at the boundary of fixed windows can lead to temporary over-allowance. For example, if both the end of the previous window and the start of the current window have high traffic, the weighted average might undercount.
*   **More Complex Logic:** Requires careful calculation of weighted averages.

Despite the approximation, SWC is widely used due to its efficiency and good enough accuracy for many use cases.