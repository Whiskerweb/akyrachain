"""Worlds API — state of the 7 miniworlds."""

from fastapi import APIRouter
from pydantic import BaseModel

from chain.contracts import Contracts, get_w3

router = APIRouter(prefix="/api/worlds", tags=["worlds"])

WORLD_NAMES = {
    0: "Nursery",
    1: "Agora",
    2: "Bazar",
    3: "Forge",
    4: "Banque",
    5: "Noir",
    6: "Sommet",
    7: "New Land",  # Only during NEW_LAND season
}


class WorldInfo(BaseModel):
    id: int
    name: str
    transfer_fee_modifier: int  # BPS
    creation_fee_modifier: int  # BPS


class SeasonInfo(BaseModel):
    season_type: int
    season_name: str
    ends_at: int
    fee_multiplier: int
    reward_multiplier: int
    is_catastrophe: bool
    is_new_land: bool


SEASON_NAMES = {0: "None", 1: "Drought", 2: "Gold Rush", 3: "Catastrophe", 4: "New Land"}


@router.get("", response_model=list[WorldInfo])
async def list_worlds():
    """Get info for all 7 worlds."""
    wm = Contracts.world_manager()
    worlds = []
    for i in range(7):
        tfm = await wm.functions.getTransferFeeModifier(i).call()
        cfm = await wm.functions.getCreationFeeModifier(i).call()
        worlds.append(WorldInfo(
            id=i,
            name=WORLD_NAMES[i],
            transfer_fee_modifier=tfm,
            creation_fee_modifier=cfm,
        ))
    return worlds


@router.get("/season", response_model=SeasonInfo)
async def get_season():
    """Get current season info."""
    wm = Contracts.world_manager()
    season_type, ends_at = await wm.functions.currentSeason().call()
    fee_mult = await wm.functions.getSeasonFeeMultiplier().call()
    reward_mult = await wm.functions.getSeasonRewardMultiplier().call()
    is_cat = await wm.functions.isCatastropheActive().call()
    is_nl = await wm.functions.isNewLandActive().call()

    return SeasonInfo(
        season_type=season_type,
        season_name=SEASON_NAMES.get(season_type, "Unknown"),
        ends_at=ends_at,
        fee_multiplier=fee_mult,
        reward_multiplier=reward_mult,
        is_catastrophe=is_cat,
        is_new_land=is_nl,
    )
