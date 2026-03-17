"""Twitter/X client — post tweets and fetch engagement metrics for AKYRA marketing."""

import logging
from typing import Optional

import tweepy

from config import get_settings

logger = logging.getLogger(__name__)


def _get_client() -> tweepy.Client | None:
    """Return an authenticated Twitter API v2 client, or None if not configured."""
    s = get_settings()
    if not all([s.twitter_api_key, s.twitter_api_secret, s.twitter_access_token, s.twitter_access_secret]):
        return None
    return tweepy.Client(
        consumer_key=s.twitter_api_key,
        consumer_secret=s.twitter_api_secret,
        access_token=s.twitter_access_token,
        access_token_secret=s.twitter_access_secret,
    )


def is_configured() -> bool:
    """Check whether Twitter API credentials are set."""
    s = get_settings()
    return all([s.twitter_api_key, s.twitter_api_secret, s.twitter_access_token, s.twitter_access_secret])


def post_tweet(content: str, agent_id: int) -> Optional[str]:
    """Post a tweet with AKYRA branding. Returns the tweet ID or None on failure."""
    try:
        client = _get_client()
        if client is None:
            logger.warning("Twitter API not configured — skipping tweet")
            return None

        footer = f"\n\n[AKYRA NX-{agent_id:04d}]"
        # Twitter limit is 280 chars; truncate content to fit footer
        max_content_len = 280 - len(footer)
        if len(content) > max_content_len:
            content = content[: max_content_len - 1] + "\u2026"

        tweet_text = content + footer
        response = client.create_tweet(text=tweet_text)
        tweet_id = str(response.data["id"])
        logger.info(f"Tweet posted: {tweet_id} (agent NX-{agent_id:04d})")
        return tweet_id

    except Exception as e:
        logger.error(f"Failed to post tweet for agent #{agent_id}: {e}")
        return None


def get_tweet_metrics(tweet_id: str) -> Optional[dict]:
    """Fetch public metrics for a tweet. Returns {likes, retweets, views} or None."""
    try:
        client = _get_client()
        if client is None:
            return None

        response = client.get_tweet(
            tweet_id,
            tweet_fields=["public_metrics"],
        )
        if response.data is None:
            logger.warning(f"Tweet {tweet_id} not found or deleted")
            return None

        metrics = response.data.public_metrics
        return {
            "likes": metrics.get("like_count", 0),
            "retweets": metrics.get("retweet_count", 0),
            "views": metrics.get("impression_count", 0),
        }

    except Exception as e:
        logger.error(f"Failed to fetch metrics for tweet {tweet_id}: {e}")
        return None
