'use strict';

const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const openclaw = require('./openclaw');
const logger = require('../utils/logger');

/**
 * Get all agents.
 */
function getAgents() {
  const db = getDb();
  return db.prepare('SELECT * FROM agents ORDER BY is_main DESC, is_default DESC, created_at ASC').all();
}

/**
 * Get agent by ID.
 */
function getAgent(agentId) {
  const db = getDb();
  return db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId);
}

/**
 * Create a new agent.
 */
function createAgent(data) {
  const db = getDb();
  const agentId = data.agentId || uuidv4().split('-')[0];

  const result = db.prepare(`
    INSERT INTO agents (name, agent_id, model, provider, system_prompt, temperature, max_tokens, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    data.name,
    agentId,
    data.model || null,
    data.provider || null,
    data.systemPrompt || null,
    data.temperature || null,
    data.maxTokens || null
  );

  // Update OpenClaw config
  syncAgentsToConfig();

  return { id: result.lastInsertRowid, agentId };
}

/**
 * Update an agent.
 */
function updateAgent(agentId, data) {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId);
  if (!agent) throw new Error('Agent không tồn tại');

  db.prepare(`
    UPDATE agents SET
      name = COALESCE(?, name),
      model = ?,
      provider = ?,
      system_prompt = ?,
      temperature = ?,
      max_tokens = ?,
      updated_at = datetime('now')
    WHERE agent_id = ?
  `).run(
    data.name || agent.name,
    data.model !== undefined ? data.model : agent.model,
    data.provider !== undefined ? data.provider : agent.provider,
    data.systemPrompt !== undefined ? data.systemPrompt : agent.system_prompt,
    data.temperature !== undefined ? data.temperature : agent.temperature,
    data.maxTokens !== undefined ? data.maxTokens : agent.max_tokens,
    agentId
  );

  syncAgentsToConfig();
}

/**
 * Delete an agent (cannot delete main agent).
 */
function deleteAgent(agentId) {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId);
  if (!agent) throw new Error('Agent không tồn tại');
  if (agent.is_main) throw new Error('Không thể xoá Main Agent');

  // Remove routing bindings
  db.prepare('DELETE FROM routing_bindings WHERE agent_id = ?').run(agentId);
  db.prepare('DELETE FROM agents WHERE agent_id = ?').run(agentId);

  syncAgentsToConfig();
}

/**
 * Set default agent.
 */
function setDefaultAgent(agentId) {
  const db = getDb();
  db.prepare('UPDATE agents SET is_default = 0').run();
  db.prepare('UPDATE agents SET is_default = 1 WHERE agent_id = ?').run(agentId);
  syncAgentsToConfig();
}

/**
 * Get routing bindings.
 */
function getRoutingBindings() {
  const db = getDb();
  return db.prepare(`
    SELECT rb.*, a.name as agent_name
    FROM routing_bindings rb
    LEFT JOIN agents a ON rb.agent_id = a.agent_id
    ORDER BY rb.priority DESC, rb.created_at ASC
  `).all();
}

/**
 * Add routing binding.
 */
function addRoutingBinding(channel, pattern, agentId) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO routing_bindings (channel, pattern, agent_id) VALUES (?, ?, ?)'
  ).run(channel, pattern || '*', agentId);

  syncAgentsToConfig();
  return { id: result.lastInsertRowid };
}

/**
 * Delete routing binding.
 */
function deleteRoutingBinding(bindingId) {
  const db = getDb();
  db.prepare('DELETE FROM routing_bindings WHERE id = ?').run(bindingId);
  syncAgentsToConfig();
}

/**
 * Sync agent configuration to openclaw.json.
 */
function syncAgentsToConfig() {
  try {
    const db = getDb();
    const agents = db.prepare('SELECT * FROM agents WHERE is_active = 1').all();
    const bindings = db.prepare('SELECT * FROM routing_bindings').all();

    const cfg = openclaw.readOpenClawConfig();
    if (!cfg.agents) cfg.agents = {};

    // Set default agent model
    const defaultAgent = agents.find(a => a.is_default) || agents.find(a => a.is_main);
    if (defaultAgent?.model && defaultAgent?.provider) {
      cfg.agents.defaults = {
        model: { primary: `${defaultAgent.provider}/${defaultAgent.model}` },
      };
    }

    // Set up agent entries (non-main agents)
    const nonMainAgents = agents.filter(a => !a.is_main);
    if (nonMainAgents.length > 0) {
      if (!cfg.agents.entries) cfg.agents.entries = {};
      for (const agent of nonMainAgents) {
        const entry = {};
        if (agent.model && agent.provider) {
          entry.model = { primary: `${agent.provider}/${agent.model}` };
        }
        if (agent.system_prompt) {
          entry.systemPrompt = agent.system_prompt;
        }
        cfg.agents.entries[agent.agent_id] = entry;
      }
    }

    // Set up routing bindings
    if (bindings.length > 0) {
      cfg.agents.bindings = bindings.map(b => ({
        channel: b.channel,
        match: b.pattern || '*',
        agentId: b.agent_id,
      }));
    }

    openclaw.writeOpenClawConfig(cfg);
  } catch (e) {
    logger.warn('Failed to sync agents to config:', e.message);
  }
}

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  setDefaultAgent,
  getRoutingBindings,
  addRoutingBinding,
  deleteRoutingBinding,
};
