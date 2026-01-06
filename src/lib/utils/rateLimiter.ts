/**
 * WhatsApp Rate Limiter
 * Prevents API rate limiting by batching messages with delays
 * 
 * Default: 5 messages per 10 seconds = 30 msg/minute = 1800 msg/hour
 * For 1000 users: ~33 minutes
 */

interface RateLimitConfig {
  messagesPerBatch: number;      // How many messages per batch
  delayBetweenBatches: number;   // Delay in ms between batches
  delayBetweenMessages: number;  // Delay in ms between individual messages in a batch
}

interface MessageToSend {
  phone: string;
  message: string;
  data?: any; // Additional data to pass through
}

interface RateLimitResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    phone: string;
    success: boolean;
    error?: string;
    data?: any;
  }>;
}

// Default configuration: 5 messages per 10 seconds
const DEFAULT_CONFIG: RateLimitConfig = {
  messagesPerBatch: 5,
  delayBetweenBatches: 10000, // 10 seconds
  delayBetweenMessages: 500,   // 0.5 seconds
};

/**
 * Send messages with rate limiting
 * Splits messages into batches and adds delays to prevent API rate limits
 * 
 * @param messages Array of messages to send
 * @param sendFunction Function that sends a single message (must return Promise<any>)
 * @param config Optional rate limit configuration
 * @param onProgress Optional callback for progress updates
 * @returns Result with success/failure counts
 */
export async function sendWithRateLimit(
  messages: MessageToSend[],
  sendFunction: (message: MessageToSend) => Promise<any>,
  config: Partial<RateLimitConfig> = {},
  onProgress?: (progress: { current: number; total: number; batch: number; totalBatches: number }) => void
): Promise<RateLimitResult> {
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { messagesPerBatch, delayBetweenBatches, delayBetweenMessages } = finalConfig;

  const results: RateLimitResult['results'] = [];
  let sentCount = 0;
  let failedCount = 0;

  // Calculate total batches
  const totalBatches = Math.ceil(messages.length / messagesPerBatch);
  
  console.log(`[RateLimiter] Starting batch send: ${messages.length} messages in ${totalBatches} batches`);
  console.log(`[RateLimiter] Config: ${messagesPerBatch} msg/batch, ${delayBetweenBatches}ms delay between batches`);

  // Process messages in batches
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * messagesPerBatch;
    const endIdx = Math.min(startIdx + messagesPerBatch, messages.length);
    const batch = messages.slice(startIdx, endIdx);

    console.log(`[RateLimiter] Batch ${batchIndex + 1}/${totalBatches}: Processing ${batch.length} messages`);

    // Send messages in current batch
    for (let i = 0; i < batch.length; i++) {
      const message = batch[i];
      const currentIndex = startIdx + i;

      try {
        // Call the send function
        await sendFunction(message);

        results.push({
          phone: message.phone,
          success: true,
          data: message.data,
        });
        sentCount++;

        console.log(`[RateLimiter] ✅ Sent ${currentIndex + 1}/${messages.length}: ${message.phone}`);

        // Report progress
        if (onProgress) {
          onProgress({
            current: currentIndex + 1,
            total: messages.length,
            batch: batchIndex + 1,
            totalBatches,
          });
        }

        // Delay between messages in same batch (except last message)
        if (i < batch.length - 1) {
          await delay(delayBetweenMessages);
        }

      } catch (error: any) {
        results.push({
          phone: message.phone,
          success: false,
          error: error.message || 'Failed to send',
          data: message.data,
        });
        failedCount++;

        console.error(`[RateLimiter] ❌ Failed ${currentIndex + 1}/${messages.length}: ${message.phone}`, error.message);
      }
    }

    // Delay between batches (except after last batch)
    if (batchIndex < totalBatches - 1) {
      console.log(`[RateLimiter] ⏳ Waiting ${delayBetweenBatches}ms before next batch...`);
      await delay(delayBetweenBatches);
    }
  }

  console.log(`[RateLimiter] ✅ Completed: ${sentCount} sent, ${failedCount} failed out of ${messages.length}`);

  return {
    success: true,
    total: messages.length,
    sent: sentCount,
    failed: failedCount,
    results,
  };
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate estimated time for sending messages
 * @param messageCount Total number of messages
 * @param config Rate limit configuration
 * @returns Estimated time in seconds
 */
export function estimateSendTime(
  messageCount: number,
  config: Partial<RateLimitConfig> = {}
): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { messagesPerBatch, delayBetweenBatches, delayBetweenMessages } = finalConfig;

  const totalBatches = Math.ceil(messageCount / messagesPerBatch);
  
  // Time for delays between batches
  const batchDelayTime = (totalBatches - 1) * delayBetweenBatches;
  
  // Time for delays between messages within batches
  const messageDelayTime = (messageCount - 1) * delayBetweenMessages;
  
  // Total time in milliseconds
  const totalTimeMs = batchDelayTime + messageDelayTime;
  
  // Convert to seconds
  return Math.ceil(totalTimeMs / 1000);
}

/**
 * Format estimated time as human-readable string
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} detik`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes} menit ${remainingSeconds} detik`
      : `${minutes} menit`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours} jam ${remainingMinutes} menit`
    : `${hours} jam`;
}
