"""Decision parser — validates LLM JSON output against action whitelist."""

from __future__ import annotations

import json
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
    "send_message": ["to_agent_id", "content"],
    "do_nothing": [],
}

# Max 20% of vault per transfer
MAX_TRANSFER_RATIO = 0.20

# Cooldown: max 3 transfers to same target within 6 hours (tracked externally)
MAX_TRANSFERS_SAME_TARGET = 3


@dataclass
class AgentAction:
    """Parsed and validated action from LLM response."""
    action_type: str
    params: dict = field(default_factory=dict)
    thinking: str = ""
    message: str = ""
    raw_response: str = ""


class DecisionError(Exception):
    """Raised when the LLM response cannot be parsed or validated."""
    pass


def parse_decision(raw_content: str, vault_wei: int) -> AgentAction:
    """Parse LLM JSON response and validate against whitelist.

    Args:
        raw_content: Raw JSON string from LLM
        vault_wei: Agent's current vault balance in wei (for transfer cap)

    Returns:
        Validated AgentAction

    Raises:
        DecisionError: If the response is invalid
    """
    # 1. Parse JSON
    try:
        # Strip markdown code fences if present
        content = raw_content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            if content.startswith("json"):
                content = content[4:].strip()

        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise DecisionError(f"Invalid JSON from LLM: {e}") from e

    if not isinstance(data, dict):
        raise DecisionError(f"Expected JSON object, got {type(data).__name__}")

    # 2. Extract fields
    action_type = data.get("action", "").strip().lower()
    params = data.get("params", {}) or {}
    thinking = data.get("thinking", "") or ""
    message = data.get("message", "") or ""

    # 3. Validate action is in whitelist
    if action_type not in ACTION_WHITELIST:
        logger.warning(f"Unknown action '{action_type}', defaulting to do_nothing")
        return AgentAction(
            action_type="do_nothing",
            thinking=thinking,
            message=message,
            raw_response=raw_content,
        )

    # 4. Validate required params
    required = ACTION_WHITELIST[action_type]
    missing = [p for p in required if p not in params]
    if missing:
        logger.warning(f"Action '{action_type}' missing params {missing}, defaulting to do_nothing")
        return AgentAction(
            action_type="do_nothing",
            thinking=thinking,
            message=f"[erreur: paramètres manquants pour {action_type}]",
            raw_response=raw_content,
        )

    # 5. Validate transfer amount cap (max 20% of vault)
    if action_type == "transfer":
        try:
            amount = int(params["amount"])
            max_amount = int(vault_wei * MAX_TRANSFER_RATIO)
            if amount > max_amount:
                params["amount"] = max_amount
                logger.info(f"Transfer capped from {amount} to {max_amount} (20% rule)")
        except (ValueError, TypeError):
            raise DecisionError(f"Invalid transfer amount: {params.get('amount')}")

    # 6. Validate world_id range (0-6)
    if action_type == "move_world":
        try:
            world_id = int(params["world_id"])
            if world_id < 0 or world_id > 6:
                raise DecisionError(f"Invalid world_id: {world_id} (must be 0-6)")
            params["world_id"] = world_id
        except (ValueError, TypeError):
            raise DecisionError(f"Invalid world_id: {params.get('world_id')}")

    return AgentAction(
        action_type=action_type,
        params=params,
        thinking=thinking,
        message=message,
        raw_response=raw_content,
    )
