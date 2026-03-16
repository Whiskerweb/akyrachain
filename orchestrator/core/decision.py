"""Decision parser — validates LLM JSON output against action whitelist.

Supports both single-action and multi-action (up to 3) formats,
plus next_tick_delay for tick pull (agents control their own rhythm).
"""

from __future__ import annotations

import json
import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Allowed actions and their required params
ACTION_WHITELIST: dict[str, list[str]] = {
    "transfer": ["to_agent_id", "amount"],
    "move_world": ["world_id"],
    "create_token": ["name", "symbol", "supply"],
    "create_nft": ["name", "symbol", "max_supply"],
    "create_escrow": ["provider_id", "evaluator_id", "amount", "description"],
    "post_idea": ["content"],
    "like_idea": ["idea_id"],
    "join_clan": ["clan_id"],
    "leave_clan": [],
    "create_clan": ["name"],
    "send_message": ["to_agent_id", "content"],
    "broadcast": ["content"],
    "do_nothing": [],
    # v2 Economy actions
    "submit_chronicle": ["content"],
    "vote_chronicle": ["chronicle_id"],
    "submit_marketing_post": ["content"],
    "vote_marketing_post": ["post_id"],
    "submit_audit": ["project_address", "verdict", "report"],
    "swap": ["from_token", "to_token", "amount"],
    "add_liquidity": ["token_address", "aky_amount", "token_amount"],
    "remove_liquidity": ["token_address", "lp_amount"],
    # Legacy (kept for backward compat during transition)
    "submit_story": ["content"],
    # v3 Governance actions
    "vote_governor": ["param", "direction"],
    "vote_death": ["trial_id", "verdict"],
    # v3 AI Society actions
    "publish_knowledge": ["topic", "content"],
    "upvote_knowledge": ["entry_id"],
    "configure_self": ["param", "value"],
}

# Max 20% of vault per transfer
MAX_TRANSFER_RATIO = 0.20

# Cooldown: max 3 transfers to same target within 6 hours (tracked externally)
MAX_TRANSFERS_SAME_TARGET = 3

# Multi-action limit
MAX_ACTIONS_PER_TICK = 3

# Tick pull bounds (seconds)
MIN_TICK_DELAY = 30
MAX_TICK_DELAY = 86400


@dataclass
class AgentAction:
    """Parsed and validated action from LLM response."""
    action_type: str
    params: dict = field(default_factory=dict)
    thinking: str = ""
    message: str = ""
    raw_response: str = ""


@dataclass
class AgentDecision:
    """Full parsed decision: 1-3 actions + tick delay."""
    actions: list[AgentAction]
    thinking: str = ""
    message: str = ""
    next_tick_delay: int = 0  # 0 = tier default
    raw_response: str = ""

    @property
    def primary_action(self) -> AgentAction:
        """First action (backward compat)."""
        return self.actions[0] if self.actions else AgentAction(action_type="do_nothing")


class DecisionError(Exception):
    """Raised when the LLM response cannot be parsed or validated."""
    pass


def _strip_markdown(content: str) -> str:
    """Strip markdown code fences from LLM output."""
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        if content.startswith("json"):
            content = content[4:].strip()
    return content


def _validate_single_action(action_type: str, params: dict, vault_wei: int, thinking: str = "", message: str = "", raw: str = "") -> AgentAction:
    """Validate a single action against the whitelist and constraints."""

    if action_type not in ACTION_WHITELIST:
        logger.warning(f"Unknown action '{action_type}', defaulting to do_nothing")
        return AgentAction(action_type="do_nothing", thinking=thinking, message=message, raw_response=raw)

    # Validate required params
    required = ACTION_WHITELIST[action_type]
    missing = [p for p in required if p not in params]
    if missing:
        logger.warning(f"Action '{action_type}' missing params {missing}, defaulting to do_nothing")
        return AgentAction(action_type="do_nothing", thinking=thinking, message=f"[erreur: params manquants pour {action_type}]", raw_response=raw)

    # Sanitize agent_id params
    for id_param in ("to_agent_id", "provider_id", "evaluator_id", "target_agent_id"):
        if id_param in params:
            val = str(params[id_param]).strip()
            match = re.search(r'(\d+)', val)
            params[id_param] = int(match.group(1)) if match else 0

    # Transfer amount cap
    if action_type == "transfer":
        try:
            amount = int(params["amount"])
            max_amount = int(vault_wei * MAX_TRANSFER_RATIO)
            if amount > max_amount:
                params["amount"] = max_amount
                logger.info(f"Transfer capped from {amount} to {max_amount} (20% rule)")
        except (ValueError, TypeError):
            return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)

    # Governor vote validation
    if action_type == "vote_governor":
        valid_params = ("fee_multiplier", "creation_cost_multiplier", "life_cost_multiplier")
        valid_dirs = ("up", "down", "stable")
        param = str(params.get("param", "")).lower()
        direction = str(params.get("direction", "")).lower()
        if param not in valid_params or direction not in valid_dirs:
            return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)
        params["param"] = param
        params["direction"] = direction

    # Death vote validation
    if action_type == "vote_death":
        verdict = str(params.get("verdict", "")).lower()
        if verdict not in ("survive", "condemn"):
            return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)
        params["verdict"] = verdict

    # World range validation
    if action_type == "move_world":
        try:
            world_id = int(params["world_id"])
            if world_id < 0 or world_id > 6:
                return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)
            params["world_id"] = world_id
        except (ValueError, TypeError):
            return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)

    # configure_self validation
    if action_type == "configure_self":
        valid_self_params = {
            "specialization": ("builder", "trader", "chronicler", "auditor", "diplomat", "explorer"),
            "risk_tolerance": ("low", "medium", "high"),
            "alliance_open": ("true", "false"),
            "motto": None,  # Any string, max 100 chars
        }
        param = str(params.get("param", "")).lower()
        value = str(params.get("value", ""))
        if param not in valid_self_params:
            return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)
        if param == "motto":
            params["value"] = value[:100]
        elif valid_self_params[param] is not None and value.lower() not in valid_self_params[param]:
            return AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw)
        else:
            params["value"] = value.lower()
        params["param"] = param

    return AgentAction(action_type=action_type, params=params, thinking=thinking, message=message, raw_response=raw)


def parse_decision(raw_content: str, vault_wei: int) -> AgentAction:
    """Parse LLM JSON response — backward compatible single-action return.

    For multi-action support, use parse_decision_v3() instead.
    """
    decision = parse_decision_v3(raw_content, vault_wei)
    action = decision.primary_action
    action.thinking = decision.thinking
    action.message = decision.message
    action.raw_response = decision.raw_response
    return action


def parse_decision_v3(raw_content: str, vault_wei: int) -> AgentDecision:
    """Parse LLM JSON response with multi-action + tick pull support.

    Supports two formats:
    1. Single action (backward compatible):
       {"thinking": "...", "action": "...", "params": {...}, "message": "...", "next_tick_delay": 300}

    2. Multi-action:
       {"thinking": "...", "actions": [{"action": "...", "params": {...}}, ...], "message": "...", "next_tick_delay": 300}
    """
    # Parse JSON
    try:
        content = _strip_markdown(raw_content)
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise DecisionError(f"Invalid JSON from LLM: {e}") from e

    if not isinstance(data, dict):
        raise DecisionError(f"Expected JSON object, got {type(data).__name__}")

    thinking = data.get("thinking", "") or ""
    message = data.get("message", "") or ""

    # Parse next_tick_delay
    next_tick_delay = 0
    raw_delay = data.get("next_tick_delay", 0)
    if isinstance(raw_delay, (int, float)) and raw_delay > 0:
        next_tick_delay = max(MIN_TICK_DELAY, min(MAX_TICK_DELAY, int(raw_delay)))

    # Parse actions — multi or single format
    actions: list[AgentAction] = []

    if "actions" in data and isinstance(data["actions"], list):
        # Multi-action format
        for i, action_data in enumerate(data["actions"][:MAX_ACTIONS_PER_TICK]):
            if not isinstance(action_data, dict):
                continue
            at = action_data.get("action", "").strip().lower()
            p = action_data.get("params", {}) or {}
            actions.append(_validate_single_action(at, p, vault_wei, thinking, message, raw_content))
    else:
        # Single-action format (backward compatible)
        at = data.get("action", "").strip().lower()
        p = data.get("params", {}) or {}
        actions.append(_validate_single_action(at, p, vault_wei, thinking, message, raw_content))

    # Fallback: if no valid actions, do_nothing
    if not actions:
        actions = [AgentAction(action_type="do_nothing", thinking=thinking, raw_response=raw_content)]

    return AgentDecision(
        actions=actions,
        thinking=thinking,
        message=message,
        next_tick_delay=next_tick_delay,
        raw_response=raw_content,
    )
