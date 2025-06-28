const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.CACHE_REDIS,
  port: 6379,
  connectTimeout: 10000,
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('ready', () => {
  console.log('Redis connection is ready');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

module.exports = redis