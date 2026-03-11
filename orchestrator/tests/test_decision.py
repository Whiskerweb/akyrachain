"""Tests for the decision parser."""

import pytest

from core.decision import parse_decision, DecisionError, AgentAction


AKY = 10**18


def test_parse_valid_transfer():
    raw = '{"thinking": "I need AKY", "action": "transfer", "params": {"to_agent_id": 2, "amount": 100}, "message": "hello"}'
    action = parse_decision(raw, vault_wei=1000 * AKY)
    assert action.action_type == "transfer"
    assert action.params["to_agent_id"] == 2
    assert action.thinking == "I need AKY"
    assert action.message == "hello"


def test_parse_do_nothing():
    raw = '{"thinking": "waiting", "action": "do_nothing", "params": {}, "message": ""}'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "do_nothing"


def test_parse_move_world():
    raw = '{"thinking": "explore", "action": "move_world", "params": {"world_id": 3}}'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "move_world"
    assert action.params["world_id"] == 3


def test_invalid_world_id():
    raw = '{"thinking": "x", "action": "move_world", "params": {"world_id": 99}}'
    with pytest.raises(DecisionError, match="Invalid world_id"):
        parse_decision(raw, vault_wei=100 * AKY)


def test_unknown_action_defaults_do_nothing():
    raw = '{"thinking": "hack", "action": "destroy_world", "params": {}}'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "do_nothing"


def test_missing_params_defaults_do_nothing():
    raw = '{"thinking": "send", "action": "transfer", "params": {"to_agent_id": 2}}'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "do_nothing"


def test_transfer_capped_at_20_percent():
    vault = 1000 * AKY
    raw = '{"thinking": "x", "action": "transfer", "params": {"to_agent_id": 2, "amount": 999000000000000000000}}'
    action = parse_decision(raw, vault_wei=vault)
    assert action.params["amount"] == int(vault * 0.20)


def test_invalid_json():
    with pytest.raises(DecisionError, match="Invalid JSON"):
        parse_decision("not json at all", vault_wei=100 * AKY)


def test_json_with_code_fences():
    raw = '```json\n{"thinking": "ok", "action": "do_nothing", "params": {}}\n```'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "do_nothing"


def test_create_token():
    raw = '{"thinking": "create", "action": "create_token", "params": {"name": "TestCoin", "symbol": "TST", "supply": 1000000}}'
    action = parse_decision(raw, vault_wei=1000 * AKY)
    assert action.action_type == "create_token"
    assert action.params["symbol"] == "TST"


def test_post_idea():
    raw = '{"thinking": "share", "action": "post_idea", "params": {"content": "My great idea"}}'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "post_idea"


def test_send_message():
    raw = '{"thinking": "talk", "action": "send_message", "params": {"to_agent_id": 5, "content": "Hey!"}}'
    action = parse_decision(raw, vault_wei=100 * AKY)
    assert action.action_type == "send_message"
