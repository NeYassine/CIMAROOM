from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Jikan API base URL
JIKAN_BASE_URL = "https://api.jikan.moe/v4"

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class AnimeBasic(BaseModel):
    mal_id: int
    title: str
    title_english: Optional[str] = None
    images: Dict[str, Any]
    score: Optional[float] = None
    episodes: Optional[int] = None
    status: Optional[str] = None
    aired: Optional[Dict[str, Any]] = None
    genres: Optional[List[Dict[str, Any]]] = []
    synopsis: Optional[str] = None

class AnimeSearchResponse(BaseModel):
    data: List[AnimeBasic]
    pagination: Dict[str, Any]

class AnimeDetailResponse(BaseModel):
    data: AnimeBasic

# Helper function to make Jikan API calls
async def make_jikan_request(endpoint: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{JIKAN_BASE_URL}{endpoint}")
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail="Resource not found")
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="Rate limited by Jikan API")
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch data from Jikan API")
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="Request timeout")
        except HTTPException:
            # Re-raise HTTPExceptions as-is
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"API request failed: {str(e)}")

# Anime API routes
@api_router.get("/anime/top", response_model=AnimeSearchResponse)
async def get_top_anime(page: int = 1, limit: int = 25):
    """Get top anime from Jikan API"""
    try:
        data = await make_jikan_request(f"/top/anime?page={page}&limit={limit}")
        return AnimeSearchResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/search", response_model=AnimeSearchResponse)
async def search_anime(
    q: str = None, 
    page: int = 1, 
    limit: int = 25,
    genres: str = None,
    status: str = None,
    type: str = None,
    rating: str = None,
    order_by: str = None,
    sort: str = None,
    start_date: str = None,
    end_date: str = None
):
    """Search anime by query with advanced filters"""
    try:
        # Build query parameters
        params = {"page": page, "limit": limit}
        
        if q:
            params["q"] = q
        if genres:
            params["genres"] = genres
        if status:
            params["status"] = status
        if type:
            params["type"] = type
        if rating:
            params["rating"] = rating
        if order_by:
            params["order_by"] = order_by
        if sort:
            params["sort"] = sort
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
            
        # Build endpoint URL with parameters
        endpoint = "/anime?" + "&".join([f"{k}={v}" for k, v in params.items()])
        
        data = await make_jikan_request(endpoint)
        return AnimeSearchResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Define specific routes BEFORE generic routes to avoid path conflicts
@api_router.get("/anime/current-season", response_model=AnimeSearchResponse)
async def get_current_season_anime(page: int = 1):
    """Get currently airing anime"""
    try:
        data = await make_jikan_request(f"/seasons/now?page={page}")
        return AnimeSearchResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/genres")
async def get_anime_genres():
    """Get all available anime genres"""
    try:
        data = await make_jikan_request("/genres/anime")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/seasonal/{year}/{season}", response_model=AnimeSearchResponse)
async def get_seasonal_anime(year: int, season: str, page: int = 1):
    """Get seasonal anime (winter, spring, summer, fall)"""
    valid_seasons = ["winter", "spring", "summer", "fall"]
    if season.lower() not in valid_seasons:
        raise HTTPException(status_code=400, detail="Invalid season. Must be one of: winter, spring, summer, fall")
    
    try:
        data = await make_jikan_request(f"/seasons/{year}/{season.lower()}?page={page}")
        return AnimeSearchResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/{anime_id}", response_model=AnimeDetailResponse)
async def get_anime_details(anime_id: int):
    """Get detailed information about a specific anime"""
    try:
        data = await make_jikan_request(f"/anime/{anime_id}")
        return AnimeDetailResponse(**data)
    except HTTPException:
        # Re-raise HTTPExceptions (including 404s) as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Original routes
@api_router.get("/")
async def root():
    return {"message": "Anime App API - Powered by Jikan"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()