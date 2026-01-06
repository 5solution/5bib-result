import Redis from 'ioredis';
import { env } from 'src/config';

export const RedisKey = {
  flag: 'flag',
  is_sync_token: 'is_sync_token' + env.env,
  is_sync_fee: 'is_sync_fee' + env.env,
  is_sync_dexscreener: 'is_sync_dexscreener_2' + env.env,
  block_number_event: 'block_number_event' + env.env,
  error_sync_price: 'error_sync_price' + env.env,
  flag_sync_token: 'flag:syncToken' + env.env,
} as const;

export const setSyncingLock = async (
  redis: Redis,
  name: string,
  time: number = 10,
) => {
  const key = `${RedisKey.flag}:${name}`;
  const result = await redis.set(key, '1', 'NX');
  if (result) {
    await redis.expire(key, time);
  }
  return result;
};

export const releaseSyncingLock = async (redis: Redis, name: string) => {
  const key = `${RedisKey.flag}:${name}`;
  await redis.del(key);
};

export const isSyncing = async (redis: Redis, name: string) => {
  const key = `${RedisKey.flag}:${name}`;
  return await redis.get(key);
};
