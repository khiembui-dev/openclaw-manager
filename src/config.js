'use strict';

const path = require('path');
const crypto = require('crypto');
const pkg = require('../package.json');

const config = {
  version: pkg.version,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3847,
  host: process.env.HOST || '0.0.0.0',

  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  encryptionKey: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),

  db: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'manager.db'),
  },

  log: {
    dir: process.env.LOG_DIR || path.join(__dirname, '..', 'data', 'logs'),
    level: process.env.LOG_LEVEL || 'info',
  },

  openclaw: {
    installDir: process.env.OPENCLAW_INSTALL_DIR || '/opt/openclaw',
    configDir: process.env.OPENCLAW_CONFIG_DIR || '/opt/openclaw/config',
    dataDir: process.env.OPENCLAW_DATA_DIR || '/opt/openclaw/data',
    image: process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:latest',
    gatewayPort: parseInt(process.env.OPENCLAW_GATEWAY_PORT, 10) || 18789,
    bridgePort: parseInt(process.env.OPENCLAW_BRIDGE_PORT, 10) || 18790,
  },

  managerDir: process.env.MANAGER_DIR || '/opt/openclaw-manager',

  // Provider definitions
  providers: [
    { id: 'openai', name: 'OpenAI (API Key)', envKey: 'OPENAI_API_KEY' },
    { id: 'chatgpt-oauth', name: 'ChatGPT OAuth (Codex)', envKey: null, oauth: true },
    { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
    { id: 'google', name: 'Google Gemini', envKey: 'GEMINI_API_KEY' },
    { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
    { id: 'groq', name: 'Groq', envKey: 'GROQ_API_KEY' },
    { id: 'together', name: 'Together AI', envKey: 'TOGETHER_API_KEY' },
    { id: 'mistral', name: 'Mistral AI', envKey: 'MISTRAL_API_KEY' },
    { id: 'xai', name: 'xAI (Grok)', envKey: 'XAI_API_KEY' },
    { id: 'cerebras', name: 'Cerebras', envKey: 'CEREBRAS_API_KEY' },
    { id: 'sambanova', name: 'SambaNova', envKey: 'SAMBANOVA_API_KEY' },
    { id: 'fireworks', name: 'Fireworks AI', envKey: 'FIREWORKS_API_KEY' },
    { id: 'cohere', name: 'Cohere', envKey: 'COHERE_API_KEY' },
    { id: 'baichuan', name: 'Baichuan AI', envKey: 'BAICHUAN_API_KEY' },
    { id: 'yi', name: 'Yi / 01.AI', envKey: 'YI_API_KEY' },
    { id: 'stepfun', name: 'Stepfun', envKey: 'STEPFUN_API_KEY' },
    { id: 'siliconflow', name: 'SiliconFlow', envKey: 'SILICONFLOW_API_KEY' },
    { id: 'novita', name: 'Novita AI', envKey: 'NOVITA_API_KEY' },
    { id: 'openrouter', name: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
    { id: 'minimax', name: 'Minimax', envKey: 'MINIMAX_API_KEY' },
  ],

  // Model lists per provider (updated 2026-04)
  models: {
    openai: [
      'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark', 'gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini', 'gpt-5.1',
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo',
      'o4-mini', 'o3', 'o3-mini', 'o3-pro', 'o1', 'o1-mini', 'o1-pro',
    ],
    'chatgpt-oauth': [
      'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark', 'gpt-5.2-codex', 'gpt-5.2',
      'gpt-5.1-codex-max', 'gpt-5.1-codex-mini', 'gpt-5.1',
      'gpt-4o', 'gpt-4o-mini',
      'o4-mini', 'o3', 'o3-mini', 'o3-pro', 'o1', 'o1-pro',
    ],
    anthropic: [
      'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5',
      'claude-opus-4-5', 'claude-sonnet-4-5',
      'claude-3.5-sonnet', 'claude-3.5-haiku',
      'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    ],
    google: [
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
      'gemini-2.0-flash', 'gemini-2.0-flash-lite',
      'gemini-1.5-pro', 'gemini-1.5-flash',
    ],
    deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner', 'deepseek-r1'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'],
    together: [
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-large-latest'],
    xai: ['grok-3', 'grok-3-mini', 'grok-2', 'grok-2-mini'],
    cerebras: ['llama-3.3-70b', 'llama-3.1-8b'],
    sambanova: ['Meta-Llama-3.3-70B-Instruct', 'DeepSeek-R1', 'Qwen2.5-72B-Instruct'],
    openrouter: ['auto', 'openai/gpt-5.4', 'anthropic/claude-opus-4-6', 'google/gemini-2.5-pro'],
  },

  // Channel definitions
  channels: [
    { id: 'telegram', name: 'Telegram', tokenField: 'TELEGRAM_BOT_TOKEN', icon: '📱' },
    { id: 'discord', name: 'Discord', tokenField: 'DISCORD_BOT_TOKEN', icon: '🎮' },
    { id: 'slack', name: 'Slack', tokenField: 'SLACK_BOT_TOKEN', icon: '💬' },
    { id: 'zalo', name: 'Zalo', tokenField: 'ZALO_BOT_TOKEN', icon: '💚' },
  ],
};

module.exports = config;
