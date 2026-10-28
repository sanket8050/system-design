// Snowflake ID generator — shard-safe unique ID without a central coordinator
// Used by Twitter, Discord, Instagram

export class SnowflakeIdGenerator {
  private readonly epoch: bigint;
  private readonly datacenterId: bigint;
  private readonly workerId: bigint;
  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(datacenterId: number, workerId: number, epoch = 1_700_000_000_000) {
    if (datacenterId > 31 || datacenterId < 0) throw new Error('datacenterId must be 0-31');
    if (workerId > 31 || workerId < 0) throw new Error('workerId must be 0-31');
    this.epoch = BigInt(epoch);
    this.datacenterId = BigInt(datacenterId);
    this.workerId = BigInt(workerId);
  }

  private currentMs(): bigint {
    return BigInt(Date.now());
  }

  nextId(): bigint {
    let ts = this.currentMs() - this.epoch;
    if (ts < this.lastTimestamp) {
      throw new Error('Clock moved backwards — cannot generate ID');
    }
    if (ts === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 0xFFFn; // 12 bits
      if (this.sequence === 0n) {
        // Sequence overflow — wait for next ms
        while (ts <= this.lastTimestamp) {
          ts = this.currentMs() - this.epoch;
        }
      }
    } else {
      this.sequence = 0n;
    }
    this.lastTimestamp = ts;
    return (ts << 22n) | (this.datacenterId << 17n) | (this.workerId << 12n) | this.sequence;
  }
}

// Quick test
const gen = new SnowflakeIdGenerator(1, 1);
const ids = Array.from({ length: 10 }, () => gen.nextId());
const unique = new Set(ids.map(String));
console.assert(unique.size === ids.length, 'All generated IDs must be unique');
console.log('Generated IDs (sample):', ids.slice(0, 3).map(String));
console.log('Snowflake ID generator tests passed');
