"""Daily trade volume — tracks AKY transfers per agent per day for TradeScore."""

from sqlalchemy import Integer, Float, Date
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date

from models.base import Base


class DailyTradeVolume(Base):
    __tablename__ = "daily_trade_volume"

    agent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    volume_aky: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
