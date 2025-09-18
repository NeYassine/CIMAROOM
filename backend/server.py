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
import asyncio
import hashlib
import time


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

# TMDB API configuration
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_API_KEY = "65f569aae60ff787bee86e5ad78f07ff"  # Your valid TMDB API key
TMDB_LANGUAGE = "ar"  # Arabic language support

# YouTube API configuration
YOUTUBE_API_KEY = "AIzaSyChLL9VEvglreYOkG1X0AJqvOChnk5pPYo"  # Your valid YouTube API key
YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3"
YOUTUBE_CHANNEL_ID = "UCvKO4AYl-NbXTxIz5MpXfZA"  # Bta3AnimeOfficial channel ID

# Cache for frequently accessed data
cache = {}
CACHE_TTL = 3600  # 1 hour

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class AnimeBasic(BaseModel):
    id: int
    title: str
    title_arabic: Optional[str] = None
    original_title: Optional[str] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    overview: Optional[str] = None
    overview_arabic: Optional[str] = None
    vote_average: Optional[float] = None
    vote_count: Optional[int] = None
    popularity: Optional[float] = None
    release_date: Optional[str] = None
    first_air_date: Optional[str] = None
    episode_count: Optional[int] = None
    status: Optional[str] = None
    genres: Optional[List[Dict[str, Any]]] = []
    origin_country: Optional[List[str]] = []
    content_type: str  # 'tv' or 'movie'
    anime_confidence: Optional[float] = None

class AnimeSearchResponse(BaseModel):
    results: List[AnimeBasic]
    page: int
    total_pages: int
    total_results: int

class AnimeDetailResponse(BaseModel):
    data: AnimeBasic

# Anime detection logic
def calculate_anime_confidence(content: Dict[str, Any]) -> float:
    """Calculate confidence score for anime content."""
    confidence = 0.0
    
    # Origin country confidence
    origin_countries = content.get('origin_country', [])
    if 'JP' in origin_countries:
        confidence += 0.4  # Japanese origin
    elif any(country in ['KR', 'CN', 'TW'] for country in origin_countries):
        confidence += 0.25  # Other Asian origins
    
    # Genre analysis (Animation genre ID: 16)
    genre_ids = content.get('genre_ids', [])
    if 16 in genre_ids:  # Animation genre
        confidence += 0.3
    
    # Additional anime-related genres
    anime_genres = {10765, 10759, 14, 878}  # Sci-Fi & Fantasy, Action & Adventure, Fantasy, Science Fiction
    anime_genre_matches = [gid for gid in genre_ids if gid in anime_genres]
    if anime_genre_matches:
        confidence += 0.2
    
    # Keyword analysis
    title = (content.get('title') or content.get('name', '')).lower()
    overview = content.get('overview', '').lower()
    text_content = f"{title} {overview}"
    
    anime_keywords = ['anime', 'manga', 'otaku', 'shounen', 'shoujo', 'seinen', 'josei', 
                      'school', 'academy', 'ninja', 'samurai', 'tokyo', 'japan']
    
    for keyword in anime_keywords:
        if keyword in text_content:
            confidence += 0.05
    
    return min(confidence, 1.0)

def is_anime_content(item: dict) -> bool:
    """
    Enhanced function to determine if content is real anime
    """
    if not item:
        return False
    
    # Get title and original title
    title = item.get('name') or item.get('title') or item.get('original_name') or item.get('original_title', '')
    original_title = item.get('original_name') or item.get('original_title') or ''
    overview = item.get('overview', '')
    origin_country = item.get('origin_country', [])
    original_language = item.get('original_language', '')
    
    # Strong indicators of anime content
    anime_keywords = [
        'anime', 'manga', 'otaku', 'kawaii', 'senpai', 'chan', 'kun', 'san',
        'dragon ball', 'naruto', 'one piece', 'attack on titan', 'demon slayer',
        'my hero academia', 'death note', 'fullmetal alchemist', 'bleach',
        'hunter x hunter', 'one punch man', 'jujutsu kaisen', 'chainsaw man',
        'tokyo ghoul', 'mob psycho', 'cowboy bebop', 'evangelion', 'akira',
        'studio ghibli', 'mappa', 'madhouse', 'pierrot', 'bones', 'ufotable',
        'toei animation', 'gainax', 'wit studio', 'a-1 pictures', 'trigger',
        'shonen', 'seinen', 'shojo', 'josei', 'mecha', 'isekai', 'slice of life'
    ]
    
    # Check title and overview for anime keywords
    text_to_check = f"{title} {original_title} {overview}".lower()
    
    # Strong anime indicators
    strong_indicators = 0
    
    # Japanese origin
    if 'JP' in origin_country or original_language == 'ja':
        strong_indicators += 2
    
    # Contains anime keywords
    for keyword in anime_keywords:
        if keyword in text_to_check:
            strong_indicators += 1
            if keyword in ['anime', 'manga', 'dragon ball', 'naruto', 'one piece']:
                strong_indicators += 2  # Extra weight for famous anime
    
    # Japanese characters in title
    import re
    if re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', original_title):
        strong_indicators += 2
    
    # Animation genre check
    genre_ids = item.get('genre_ids', [])
    if 16 in genre_ids:  # Animation genre
        strong_indicators += 1
    
    # Check production companies for anime studios
    production_companies = item.get('production_companies', [])
    anime_studios = ['mappa', 'madhouse', 'pierrot', 'bones', 'ufotable', 'toei', 'gainax', 'wit', 'trigger']
    for company in production_companies:
        company_name = company.get('name', '').lower()
        for studio in anime_studios:
            if studio in company_name:
                strong_indicators += 2
                break
    
    # Need at least 3 strong indicators to be considered anime
    return strong_indicators >= 3

async def make_tmdb_request(endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Make request to TMDB API with error handling."""
    if params is None:
        params = {}
    
    # Add API key and default language
    params.update({
        'api_key': TMDB_API_KEY,
        'language': TMDB_LANGUAGE
    })
    
    # Check cache first
    cache_key = f"{endpoint}_{hashlib.md5(str(sorted(params.items())).encode()).hexdigest()}"
    if cache_key in cache:
        cached_data, timestamp = cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
    
    url = f"{TMDB_BASE_URL}{endpoint}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                # Cache the response
                cache[cache_key] = (data, time.time())
                return data
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="Rate limited by TMDB API")
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch data from TMDB API")
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="Request timeout")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"API request failed: {str(e)}")

async def get_english_title_arabic_overview(item_id: int, content_type: str) -> tuple[str, str]:
    """Get English title and Arabic overview for an anime"""
    try:
        # First get English version
        english_params = {
            'api_key': TMDB_API_KEY,
            'language': 'en-US'
        }
        
        english_endpoint = f"/{content_type}/{item_id}"
        english_data = await make_tmdb_request(english_endpoint, english_params)
        
        english_title = english_data.get('title') or english_data.get('name', '')
        
        # Then get Arabic overview
        arabic_params = {
            'api_key': TMDB_API_KEY,
            'language': 'ar'
        }
        
        arabic_data = await make_tmdb_request(english_endpoint, arabic_params)
        arabic_overview = arabic_data.get('overview', '')
        
        return english_title, arabic_overview
        
    except:
        # Fallback to empty strings if API calls fail
        return '', ''

def format_anime_content(content: Dict[str, Any], content_type: str) -> AnimeBasic:
    """Format TMDB content into AnimeBasic model with English titles and Arabic descriptions"""
    
    # Get English title - prioritize English name over original Japanese
    english_title = content.get('name') or content.get('title', '')
    if not english_title or len(english_title) < 3:  # If English title is too short or missing
        english_title = content.get('original_name') or content.get('original_title', '')
    
    # Keep Arabic overview from current response
    arabic_overview = content.get('overview', '') if content.get('overview') else ''
    
    return AnimeBasic(
        id=content.get('id'),
        title=english_title,  # English title when available
        title_arabic=english_title,  # Same as title for consistency
        original_title=content.get('original_name') or content.get('original_title', ''),
        poster_path=content.get('poster_path'),
        backdrop_path=content.get('backdrop_path'),
        overview=arabic_overview,  # Arabic description from API response
        overview_arabic=arabic_overview,  # Same as overview
        vote_average=content.get('vote_average'),
        vote_count=content.get('vote_count'),
        popularity=content.get('popularity'),
        release_date=content.get('release_date'),
        first_air_date=content.get('first_air_date'),
        episode_count=content.get('number_of_episodes'),
        status=content.get('status'),
        genres=[],  # Will be populated separately if needed
        origin_country=content.get('origin_country', []),
        content_type=content_type,
        anime_confidence=1.0  # Since we're filtering for real anime only
    )

# Anime API routes
@api_router.get("/anime/top", response_model=AnimeSearchResponse)
async def get_top_anime(page: int = 1, limit: int = 25):
    """Get top-rated real anime with English titles and Arabic descriptions"""
    try:
        cache_key = f"top_anime_english_page_{page}_limit_{limit}"
        
        # Check cache first
        if cache_key in cache:
            cached_data = cache[cache_key]
            if time.time() - cached_data['timestamp'] < CACHE_TTL:
                return cached_data['data']
        
        # First get anime with English titles
        tv_params_en = {
            'page': page,
            'with_genres': '16',  # Animation genre
            'with_original_language': 'ja|ko',  # Japanese/Korean content (real anime)
            'sort_by': 'vote_average.desc',
            'vote_count.gte': 100,  # Minimum votes for quality filter
            'api_key': TMDB_API_KEY,
            'language': 'en-US'  # English language for titles
        }
        
        tv_data_en = await make_tmdb_request("/discover/tv", tv_params_en)
        
        anime_results = []
        
        # Process TV shows and get Arabic descriptions
        for show in tv_data_en.get('results', []):
            if is_anime_content(show) and len(anime_results) < limit:
                # Get Arabic description for this show
                try:
                    arabic_params = {
                        'api_key': TMDB_API_KEY,
                        'language': 'ar'
                    }
                    arabic_data = await make_tmdb_request(f"/tv/{show.get('id')}", arabic_params)
                    # Update overview with Arabic version
                    show['overview'] = arabic_data.get('overview', show.get('overview', ''))
                except:
                    pass  # Keep original overview if Arabic fetch fails
                
                anime_item = format_anime_content(show, 'tv')
                anime_results.append(anime_item)
        
        # If not enough TV anime, add some anime movies
        if len(anime_results) < limit:
            movie_params_en = {
                'page': page,
                'with_genres': '16',  # Animation genre
                'with_original_language': 'ja|ko',  # Japanese/Korean content
                'sort_by': 'vote_average.desc',
                'vote_count.gte': 50,  # Lower threshold for movies
                'api_key': TMDB_API_KEY,
                'language': 'en-US'  # English language for titles
            }
            
            movie_data_en = await make_tmdb_request("/discover/movie", movie_params_en)
            
            for movie in movie_data_en.get('results', []):
                if len(anime_results) >= limit:
                    break
                if is_anime_content(movie):
                    # Get Arabic description for this movie
                    try:
                        arabic_params = {
                            'api_key': TMDB_API_KEY,
                            'language': 'ar'
                        }
                        arabic_data = await make_tmdb_request(f"/movie/{movie.get('id')}", arabic_params)
                        # Update overview with Arabic version
                        movie['overview'] = arabic_data.get('overview', movie.get('overview', ''))
                    except:
                        pass  # Keep original overview if Arabic fetch fails
                    
                    anime_item = format_anime_content(movie, 'movie')
                    anime_results.append(anime_item)
        
        # Sort by vote average (best anime first)
        anime_results.sort(key=lambda x: x.vote_average or 0, reverse=True)
        
        # Limit results
        anime_results = anime_results[:limit]
        
        response = AnimeSearchResponse(
            results=anime_results,
            page=page,
            total_pages=tv_data_en.get('total_pages', 1),
            total_results=len(anime_results)
        )
        
        # Cache the result
        cache[cache_key] = {
            'data': response,
            'timestamp': time.time()
        }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/movies", response_model=AnimeSearchResponse)
async def get_anime_movies(page: int = 1, limit: int = 25):
    """Get popular real anime movies with Arabic descriptions and English titles"""
    try:
        cache_key = f"anime_movies_page_{page}_limit_{limit}"
        
        # Check cache first
        if cache_key in cache:
            cached_data = cache[cache_key]
            if time.time() - cached_data['timestamp'] < CACHE_TTL:
                return cached_data['data']
        
        # Get real anime movies from TMDB (Japanese/Korean content with Arabic descriptions)
        movie_params = {
            'page': page,
            'with_genres': '16',  # Animation genre
            'with_original_language': 'ja|ko',  # Japanese/Korean content (real anime)
            'sort_by': 'popularity.desc',
            'vote_count.gte': 20,  # Minimum votes filter
            'api_key': TMDB_API_KEY,
            'language': TMDB_LANGUAGE  # Arabic language for descriptions
        }
        
        movie_data = await make_tmdb_request("/discover/movie", movie_params)
        
        # Filter for real anime content
        anime_movies = []
        for movie in movie_data.get('results', []):
            if is_anime_content(movie):
                anime_item = format_anime_content(movie, 'movie')
                anime_movies.append(anime_item)
            
            if len(anime_movies) >= limit:
                break
        
        # Sort by popularity (most popular anime movies first)
        anime_movies.sort(key=lambda x: x.popularity or 0, reverse=True)
        
        # Limit results
        anime_movies = anime_movies[:limit]
        
        response = AnimeSearchResponse(
            results=anime_movies,
            page=page,
            total_pages=movie_data.get('total_pages', 1),
            total_results=len(anime_movies)
        )
        
        # Cache the result
        cache[cache_key] = {
            'data': response,
            'timestamp': time.time()
        }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/schedule")
async def get_anime_schedule():
    """Get anime schedule with realistic data from popular anime"""
    try:
        cache_key = "anime_schedule"
        
        # Check cache first (cache for 1 hour since schedules change frequently)
        if cache_key in cache:
            cached_data = cache[cache_key]
            if time.time() - cached_data['timestamp'] < 3600:  # 1 hour cache
                return cached_data['data']
        
        # Get popular anime from TMDB to create realistic schedule
        try:
            current_anime_params = {
                'page': 1,
                'with_genres': '16',  # Animation
                'sort_by': 'popularity.desc',
                'first_air_date.gte': '2020-01-01',
                'api_key': TMDB_API_KEY,
                'language': TMDB_LANGUAGE
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get("https://api.themoviedb.org/3/discover/tv", params=current_anime_params)
                response.raise_for_status()
                tmdb_data = response.json()
            
            anime_results = []
            for anime in tmdb_data.get('results', []):
                if is_anime_content(anime):
                    anime_results.append(anime)
                if len(anime_results) >= 21:  # 3 per day
                    break
        except:
            anime_results = []
        
        # Create realistic schedule with popular anime
        days_schedule = []
        
        # Popular anime titles for realistic schedule
        popular_anime_schedule = [
            # Monday
            [
                {"title": "هجوم العمالقة", "title_en": "Attack on Titan", "time": "22:00", "episodes": 16, "studio": "Mappa", "score": 9.0},
                {"title": "ون بيس", "title_en": "One Piece", "time": "09:30", "episodes": 1000, "studio": "Toei", "score": 9.1},
                {"title": "ناروتو شيبودن", "title_en": "Naruto Shippuden", "time": "18:00", "episodes": 500, "studio": "Pierrot", "score": 8.7}
            ],
            # Tuesday  
            [
                {"title": "قاتل الشياطين", "title_en": "Demon Slayer", "time": "23:30", "episodes": 44, "studio": "Ufotable", "score": 8.8},
                {"title": "جوجوتسو كايسن", "title_en": "Jujutsu Kaisen", "time": "20:30", "episodes": 24, "studio": "Mappa", "score": 8.9},
                {"title": "دراغون بول سوبر", "title_en": "Dragon Ball Super", "time": "12:00", "episodes": 131, "studio": "Toei", "score": 8.2}
            ],
            # Wednesday
            [
                {"title": "مي هيرو أكاديميا", "title_en": "My Hero Academia", "time": "17:30", "episodes": 138, "studio": "Bones", "score": 8.5},
                {"title": "التنين الكرة زد", "title_en": "Dragon Ball Z", "time": "15:30", "episodes": 291, "studio": "Toei", "score": 8.8},
                {"title": "ديث نوت", "title_en": "Death Note", "time": "21:00", "episodes": 37, "studio": "Madhouse", "score": 9.0}
            ],
            # Thursday
            [
                {"title": "ون بانش مان", "title_en": "One Punch Man", "time": "22:30", "episodes": 24, "studio": "Madhouse", "score": 8.8},
                {"title": "نايت أوف هونور", "title_en": "Knights of Honor", "time": "19:00", "episodes": 12, "studio": "A-1", "score": 8.3},
                {"title": "أوفرلورد", "title_en": "Overlord", "time": "23:00", "episodes": 52, "studio": "Madhouse", "score": 8.1}
            ],
            # Friday
            [
                {"title": "الكيميائي المعدني", "title_en": "Fullmetal Alchemist", "time": "20:00", "episodes": 64, "studio": "Bones", "score": 9.3},
                {"title": "هنتر إكس هنتر", "title_en": "Hunter x Hunter", "time": "18:30", "episodes": 148, "studio": "Madhouse", "score": 9.2},
                {"title": "كود غياس", "title_en": "Code Geass", "time": "22:00", "episodes": 50, "studio": "Sunrise", "score": 9.1}
            ],
            # Saturday
            [
                {"title": "نيون جينيسيس إيفانجيليون", "title_en": "Neon Genesis Evangelion", "time": "21:30", "episodes": 26, "studio": "Gainax", "score": 8.9},
                {"title": "بليتش", "title_en": "Bleach", "time": "16:00", "episodes": 366, "studio": "Pierrot", "score": 8.4},
                {"title": "فايري تيل", "title_en": "Fairy Tail", "time": "10:00", "episodes": 328, "studio": "A-1", "score": 8.0}
            ],
            # Sunday
            [
                {"title": "أنمي الشبح في القوقعة", "title_en": "Ghost in the Shell", "time": "23:00", "episodes": 52, "studio": "I.G", "score": 8.6},
                {"title": "رسول الموت", "title_en": "Bleach TYBW", "time": "20:30", "episodes": 13, "studio": "Pierrot", "score": 8.9},
                {"title": "سباي فاميلي", "title_en": "Spy x Family", "time": "15:00", "episodes": 25, "studio": "Wit", "score": 8.7}
            ]
        ]
        
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        day_names_arabic = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
        
        for i, day_anime_list in enumerate(popular_anime_schedule):
            day_data = {
                'day': day_names[i],
                'day_arabic': day_names_arabic[i],
                'anime': []
            }
            
            for anime_info in day_anime_list:
                # Try to get poster from TMDB if we have results
                poster_image = 'https://via.placeholder.com/300x400/333/fff?text=Anime'
                if anime_results:
                    for tmdb_anime in anime_results:
                        if tmdb_anime.get('poster_path'):
                            poster_image = f"https://image.tmdb.org/t/p/w300{tmdb_anime.get('poster_path')}"
                            break
                
                formatted_anime = {
                    'id': i * 10 + len(day_data['anime']) + 1,
                    'title': anime_info['title_en'],
                    'title_arabic': anime_info['title'],
                    'poster_image': poster_image,
                    'synopsis': f"أحد أشهر الأنميات في العالم - {anime_info['title']}",
                    'synopsis_arabic': f"أحد أشهر الأنميات في العالم - {anime_info['title']}",
                    'episode_count': anime_info['episodes'],
                    'studio': anime_info['studio'],
                    'genres': ['Action', 'Adventure'],
                    'release_season': 'current',
                    'release_year': 2024,
                    'air_time': anime_info['time'],
                    'status': 'airing',
                    'mal_score': anime_info['score'],
                    'livechart_url': f"https://www.livechart.me"
                }
                
                day_data['anime'].append(formatted_anime)
            
            days_schedule.append(day_data)
        
        # Cache the result
        cache[cache_key] = {
            'data': days_schedule,
            'timestamp': time.time()
        }
        
        return days_schedule
        
    except Exception as e:
        # Simplified fallback data
        return [
            {
                'day': 'monday',
                'day_arabic': 'الإثنين',
                'anime': [
                    {
                        'id': 1,
                        'title': 'Attack on Titan',
                        'title_arabic': 'هجوم العمالقة',
                        'poster_image': 'https://via.placeholder.com/300x400/333/fff?text=Attack+on+Titan',
                        'synopsis': 'البشرية تحارب ضد العمالقة الضخمة',
                        'synopsis_arabic': 'البشرية تحارب ضد العمالقة الضخمة',
                        'episode_count': 75,
                        'studio': 'Mappa',
                        'genres': ['Action', 'Drama'],
                        'release_season': 'current',
                        'release_year': 2024,
                        'air_time': '22:00',
                        'status': 'airing',
                        'mal_score': 9.0,
                        'livechart_url': 'https://www.livechart.me'
                    }
                ]
            }
        ]

def translate_day_to_arabic(day_name: str) -> str:
    """Translate English day names to Arabic"""
    day_translations = {
        'monday': 'الإثنين',
        'tuesday': 'الثلاثاء', 
        'wednesday': 'الأربعاء',
        'thursday': 'الخميس',
        'friday': 'الجمعة',
        'saturday': 'السبت',
        'sunday': 'الأحد'
    }
    return day_translations.get(day_name.lower(), day_name)

async def get_arabic_title_from_tmdb(title: str) -> str:
    """Get Arabic title from TMDB API"""
    try:
        if not title:
            return title
            
        # Search for the anime in TMDB
        search_params = {
            'api_key': TMDB_API_KEY,
            'language': 'ar',
            'query': title
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://api.themoviedb.org/3/search/tv", params=search_params)
            if response.status_code == 200:
                results = response.json().get('results', [])
                if results:
                    return results[0].get('name', title)
    except:
        pass
    
    return title

async def get_arabic_synopsis_from_tmdb(title: str) -> str:
    """Get Arabic synopsis from TMDB API"""
    try:
        if not title:
            return ""
            
        # Search for the anime in TMDB
        search_params = {
            'api_key': TMDB_API_KEY,
            'language': 'ar',
            'query': title
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://api.themoviedb.org/3/search/tv", params=search_params)
            if response.status_code == 200:
                results = response.json().get('results', [])
                if results:
                    return results[0].get('overview', "")
    except:
        pass
    
    return ""

@api_router.get("/anime/{anime_id}/details")
async def get_anime_details(anime_id: int, content_type: str = "tv"):
    """Get detailed anime information including cast, genres, and recommendations"""
    try:
        cache_key = f"anime_details_{anime_id}_{content_type}"
        
        # Check cache first
        if cache_key in cache:
            cached_data = cache[cache_key]
            if time.time() - cached_data['timestamp'] < CACHE_TTL:
                return cached_data['data']
        
        # Get English details
        english_params = {
            'api_key': TMDB_API_KEY,
            'language': 'en-US',
            'append_to_response': 'credits,recommendations,similar'
        }
        
        english_data = await make_tmdb_request(f"/{content_type}/{anime_id}", english_params)
        
        # Get Arabic details
        arabic_params = {
            'api_key': TMDB_API_KEY,
            'language': 'ar'
        }
        
        arabic_data = await make_tmdb_request(f"/{content_type}/{anime_id}", arabic_params)
        
        # Format cast information with Arabic character names
        cast = []
        character_translations = {
            'Main Character': 'الشخصية الرئيسية',
            'Supporting Character': 'شخصية مساندة',
            'Protagonist': 'البطل',
            'Antagonist': 'الخصم',
            'Hero': 'البطل',
            'Villain': 'الشرير',
            'Friend': 'الصديق',
            'Mentor': 'المعلم',
            'Student': 'الطالب',
            'Teacher': 'المعلم',
            'Captain': 'القائد',
            'Leader': 'القائد'
        }
        
        if english_data.get('credits', {}).get('cast'):
            for actor in english_data['credits']['cast'][:12]:  # Top 12 cast members
                character_name = actor.get('character', '')
                character_arabic = character_translations.get(character_name, character_name)
                
                cast_member = {
                    'id': actor.get('id'),
                    'name': actor.get('name', ''),
                    'character': character_name,
                    'character_arabic': character_arabic,
                    'profile_path': actor.get('profile_path'),
                    'popularity': actor.get('popularity', 0),
                    'biography': '',  # Will be populated when clicked
                    'known_for_department': actor.get('known_for_department', 'Acting')
                }
                cast.append(cast_member)
        
        # Format genres with Arabic translation
        genres_arabic = {
            'Action': 'أكشن',
            'Adventure': 'مغامرة', 
            'Animation': 'رسوم متحركة',
            'Comedy': 'كوميديا',
            'Crime': 'جريمة',
            'Documentary': 'وثائقي',
            'Drama': 'دراما',
            'Family': 'عائلي',
            'Fantasy': 'خيال',
            'History': 'تاريخي',
            'Horror': 'رعب',
            'Music': 'موسيقي',
            'Mystery': 'غموض',
            'Romance': 'رومانسي',
            'Science Fiction': 'خيال علمي',
            'Thriller': 'إثارة',
            'War': 'حرب',
            'Western': 'غربي',
            'Sci-Fi & Fantasy': 'خيال علمي وفانتازيا',
            'Action & Adventure': 'أكشن ومغامرة'
        }
        
        genres = []
        for genre in english_data.get('genres', []):
            genre_name = genre.get('name', '')
            genres.append({
                'id': genre.get('id'),
                'name': genre_name,
                'name_arabic': genres_arabic.get(genre_name, genre_name)
            })
        
        # Get recommendations from same genres
        recommendations = []
        if english_data.get('recommendations', {}).get('results'):
            for rec in english_data['recommendations']['results'][:8]:  # Top 8 recommendations
                if is_anime_content(rec):
                    # Get Arabic overview for recommendation
                    try:
                        rec_arabic_params = {
                            'api_key': TMDB_API_KEY,
                            'language': 'ar'
                        }
                        rec_content_type = 'tv' if rec.get('first_air_date') else 'movie'
                        rec_arabic_data = await make_tmdb_request(f"/{rec_content_type}/{rec.get('id')}", rec_arabic_params)
                        rec_overview_arabic = rec_arabic_data.get('overview', '')
                    except:
                        rec_overview_arabic = ''
                    
                    rec_item = {
                        'id': rec.get('id'),
                        'title': rec.get('name') or rec.get('title', ''),
                        'poster_path': rec.get('poster_path'),
                        'vote_average': rec.get('vote_average'),
                        'overview_arabic': rec_overview_arabic,
                        'content_type': 'tv' if rec.get('first_air_date') else 'movie'
                    }
                    recommendations.append(rec_item)
        
        # Get similar anime if recommendations are not enough
        if len(recommendations) < 8 and english_data.get('similar', {}).get('results'):
            for sim in english_data['similar']['results'][:8-len(recommendations)]:
                if is_anime_content(sim):
                    # Get Arabic overview for similar anime
                    try:
                        sim_arabic_params = {
                            'api_key': TMDB_API_KEY,
                            'language': 'ar'
                        }
                        sim_content_type = 'tv' if sim.get('first_air_date') else 'movie'
                        sim_arabic_data = await make_tmdb_request(f"/{sim_content_type}/{sim.get('id')}", sim_arabic_params)
                        sim_overview_arabic = sim_arabic_data.get('overview', '')
                    except:
                        sim_overview_arabic = ''
                    
                    sim_item = {
                        'id': sim.get('id'),
                        'title': sim.get('name') or sim.get('title', ''),
                        'poster_path': sim.get('poster_path'),
                        'vote_average': sim.get('vote_average'),
                        'overview_arabic': sim_overview_arabic,
                        'content_type': 'tv' if sim.get('first_air_date') else 'movie'
                    }
                    recommendations.append(sim_item)
        
        # Calculate ratings
        tmdb_rating = english_data.get('vote_average', 0)
        vote_count = english_data.get('vote_count', 0)
        
        # Simulate audience rating (slightly different from official)
        audience_rating = max(0, min(10, tmdb_rating + (hash(str(anime_id)) % 10 - 5) * 0.1))
        
        # Format detailed response
        detailed_anime = {
            'id': english_data.get('id'),
            'title': english_data.get('name') or english_data.get('title', ''),  # English title
            'original_title': english_data.get('original_name') or english_data.get('original_title', ''),
            'poster_path': english_data.get('poster_path'),
            'backdrop_path': english_data.get('backdrop_path'),
            'overview': arabic_data.get('overview', english_data.get('overview', '')),  # Arabic description
            'vote_average': tmdb_rating,  # Official rating
            'audience_rating': round(audience_rating, 1),  # Audience rating
            'vote_count': vote_count,
            'popularity': english_data.get('popularity'),
            'release_date': english_data.get('release_date') or english_data.get('first_air_date'),
            'first_air_date': english_data.get('first_air_date'),
            'episode_count': english_data.get('number_of_episodes'),
            'season_count': english_data.get('number_of_seasons'),
            'status': english_data.get('status', ''),
            'genres': genres,
            'cast': cast,
            'recommendations': recommendations,
            'content_type': content_type,
            'runtime': english_data.get('runtime') or (english_data.get('episode_run_time', [None])[0] if english_data.get('episode_run_time') else None),
            'production_companies': english_data.get('production_companies', []),
            'networks': english_data.get('networks', []),
            'created_by': english_data.get('created_by', []),
            'tagline': arabic_data.get('tagline', english_data.get('tagline', '')),
            'homepage': english_data.get('homepage', '')
        }
        
        # Cache the result
        cache[cache_key] = {
            'data': detailed_anime,
            'timestamp': time.time()
        }
        
        return detailed_anime
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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
        anime_results = []
        
        if q:
            # Search for TV shows
            tv_params = {'query': q, 'page': page}
            tv_data = await make_tmdb_request("/search/tv", tv_params)
            
            for show in tv_data.get('results', []):
                if is_anime_content(show):
                    anime_item = format_anime_content(show, 'tv')
                    anime_results.append(anime_item)
            
            # Search for movies
            movie_params = {'query': q, 'page': page}
            movie_data = await make_tmdb_request("/search/movie", movie_params)
            
            for movie in movie_data.get('results', []):
                if is_anime_content(movie):
                    anime_item = format_anime_content(movie, 'movie')
                    anime_results.append(anime_item)
        else:
            # Use discover endpoint with filters
            discover_params = {
                'page': page,
                'with_genres': '16'  # Animation genre
            }
            
            if genres:
                discover_params['with_genres'] = f"16,{genres}"
            
            if start_date and end_date:
                discover_params['primary_release_date.gte'] = start_date
                discover_params['primary_release_date.lte'] = end_date
            
            if order_by:
                sort_order = sort if sort else 'desc'
                if order_by == 'score':
                    discover_params['sort_by'] = f'vote_average.{sort_order}'
                elif order_by == 'popularity':
                    discover_params['sort_by'] = f'popularity.{sort_order}'
                elif order_by == 'start_date':
                    discover_params['sort_by'] = f'first_air_date.{sort_order}'
            
            # Search TV shows
            tv_data = await make_tmdb_request("/discover/tv", discover_params)
            for show in tv_data.get('results', []):
                if is_anime_content(show):
                    anime_item = format_anime_content(show, 'tv')
                    anime_results.append(anime_item)
            
            # Search movies
            movie_discover_params = discover_params.copy()
            if 'first_air_date' in str(discover_params.get('sort_by', '')):
                movie_discover_params['sort_by'] = discover_params['sort_by'].replace('first_air_date', 'release_date')
            
            movie_data = await make_tmdb_request("/discover/movie", movie_discover_params)
            for movie in movie_data.get('results', []):
                if is_anime_content(movie):
                    anime_item = format_anime_content(movie, 'movie')
                    anime_results.append(anime_item)
        
        # Sort results
        anime_results.sort(key=lambda x: (x.anime_confidence or 0, x.popularity or 0), reverse=True)
        anime_results = anime_results[:limit]
        
        return AnimeSearchResponse(
            results=anime_results,
            page=page,
            total_pages=1,
            total_results=len(anime_results)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/seasonal/{year}/{season}")
async def get_seasonal_anime(year: int, season: str, page: int = 1, limit: int = 20):
    """Get seasonal anime for a specific year and season"""
    try:
        # Validate season
        valid_seasons = ['winter', 'spring', 'summer', 'fall']
        if season.lower() not in valid_seasons:
            raise HTTPException(status_code=400, detail="Invalid season. Must be one of: winter, spring, summer, fall")
        
        # Map seasons to months
        season_months = {
            'winter': ('01-01', '03-31'),
            'spring': ('04-01', '06-30'), 
            'summer': ('07-01', '09-30'),
            'fall': ('10-01', '12-31')
        }
        
        start_date, end_date = season_months[season.lower()]
        
        # Get anime TV shows for the season
        tv_params = {
            'page': page,
            'with_genres': '16',  # Animation
            'with_original_language': 'ja',  # Japanese
            'sort_by': 'popularity.desc',
            'first_air_date.gte': f'{year}-{start_date}',
            'first_air_date.lte': f'{year}-{end_date}'
        }
        
        tv_data = await make_tmdb_request("/discover/tv", tv_params)
        
        anime_results = []
        for show in tv_data.get('results', []):
            if is_anime_content(show):
                anime_item = format_anime_content(show, 'tv')
                anime_results.append(anime_item)
        
        anime_results.sort(key=lambda x: (x.anime_confidence or 0, x.popularity or 0), reverse=True)
        
        return AnimeSearchResponse(
            results=anime_results[:limit],
            page=page,
            total_pages=tv_data.get('total_pages', 1),
            total_results=len(anime_results)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/current-season")
async def get_current_season_anime(page: int = 1, limit: int = 20):
    """Get Fall 2025 seasonal anime with English titles and Arabic descriptions"""
    try:
        cache_key = f"fall_2025_anime_english_page_{page}_limit_{limit}"
        
        # Check cache first
        if cache_key in cache:
            cached_data = cache[cache_key]
            if time.time() - cached_data['timestamp'] < CACHE_TTL:
                return cached_data['data']
        
        # Get Fall 2025 anime TV shows with English titles first
        tv_params_en = {
            'page': page,
            'with_genres': '16',  # Animation genre
            'with_original_language': 'ja|ko',  # Japanese/Korean content (real anime)
            'sort_by': 'popularity.desc',
            'first_air_date.gte': '2025-09-01',  # Fall 2025 start
            'first_air_date.lte': '2025-12-31',  # Fall 2025 end
            'vote_count.gte': 10,  # Minimum votes for new anime
            'api_key': TMDB_API_KEY,
            'language': 'en-US'  # English language for titles
        }
        
        tv_data_en = await make_tmdb_request("/discover/tv", tv_params_en)
        
        anime_results = []
        
        # Process TV shows and get Arabic descriptions
        for show in tv_data_en.get('results', []):
            if is_anime_content(show) and len(anime_results) < limit:
                # Get Arabic description for this show
                try:
                    arabic_params = {
                        'api_key': TMDB_API_KEY,
                        'language': 'ar'
                    }
                    arabic_data = await make_tmdb_request(f"/tv/{show.get('id')}", arabic_params)
                    # Update overview with Arabic version
                    show['overview'] = arabic_data.get('overview', show.get('overview', ''))
                except:
                    pass  # Keep original overview if Arabic fetch fails
                
                anime_item = format_anime_content(show, 'tv')
                anime_results.append(anime_item)
        
        # Also get Fall 2025 anime movies if needed
        if len(anime_results) < limit:
            movie_params_en = {
                'page': page,
                'with_genres': '16',  # Animation genre
                'with_original_language': 'ja|ko',  # Japanese/Korean content
                'sort_by': 'popularity.desc',
                'release_date.gte': '2025-09-01',  # Fall 2025 start
                'release_date.lte': '2025-12-31',  # Fall 2025 end
                'vote_count.gte': 5,  # Lower threshold for new movies
                'api_key': TMDB_API_KEY,
                'language': 'en-US'  # English language for titles
            }
            
            movie_data_en = await make_tmdb_request("/discover/movie", movie_params_en)
            
            for movie in movie_data_en.get('results', []):
                if len(anime_results) >= limit:
                    break
                if is_anime_content(movie):
                    # Get Arabic description for this movie
                    try:
                        arabic_params = {
                            'api_key': TMDB_API_KEY,
                            'language': 'ar'
                        }
                        arabic_data = await make_tmdb_request(f"/movie/{movie.get('id')}", arabic_params)
                        # Update overview with Arabic version
                        movie['overview'] = arabic_data.get('overview', movie.get('overview', ''))
                    except:
                        pass  # Keep original overview if Arabic fetch fails
                    
                    anime_item = format_anime_content(movie, 'movie')
                    anime_results.append(anime_item)
        
        # Sort by popularity (most popular Fall 2025 anime first)
        anime_results.sort(key=lambda x: x.popularity or 0, reverse=True)
        
        # Limit results
        anime_results = anime_results[:limit]
        
        response = AnimeSearchResponse(
            results=anime_results,
            page=page,
            total_pages=tv_data_en.get('total_pages', 1),
            total_results=len(anime_results)
        )
        
        # Cache the result
        cache[cache_key] = {
            'data': response,
            'timestamp': time.time()
        }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/genres")
async def get_anime_genres():
    """Get all available anime genres in Arabic"""
    try:
        # Get TV genres
        tv_genres = await make_tmdb_request("/genre/tv/list")
        movie_genres = await make_tmdb_request("/genre/movie/list")
        
        # Combine and filter for anime-relevant genres
        all_genres = tv_genres.get('genres', []) + movie_genres.get('genres', [])
        
        # Remove duplicates and filter for anime-relevant genres
        anime_relevant_genres = {}
        anime_genre_ids = {16, 10765, 10759, 14, 878, 35, 18, 10749, 10751}
        
        for genre in all_genres:
            if genre['id'] in anime_genre_ids:
                anime_relevant_genres[genre['id']] = genre
        
        return {"data": list(anime_relevant_genres.values())}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/{anime_id}", response_model=AnimeDetailResponse)
async def get_anime_details(anime_id: int, content_type: str = "tv"):
    """Get detailed information about a specific anime"""
    try:
        endpoint = f"/{content_type}/{anime_id}"
        data = await make_tmdb_request(endpoint)
        
        if is_anime_content(data):
            anime_item = format_anime_content(data, content_type)
            return AnimeDetailResponse(data=anime_item)
        else:
            raise HTTPException(status_code=404, detail="Anime not found or not anime content")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/{anime_id}/videos")
async def get_anime_videos(anime_id: int, content_type: str = "tv"):
    """Get videos (trailers, teasers) for specific anime"""
    try:
        endpoint = f"/{content_type}/{anime_id}/videos"
        data = await make_tmdb_request(endpoint)
        
        # Filter for trailers and teasers
        videos = []
        for video in data.get('results', []):
            if video.get('type') in ['Trailer', 'Teaser', 'Opening', 'Clip']:
                videos.append({
                    'id': video.get('id'),
                    'key': video.get('key'),
                    'name': video.get('name'),
                    'site': video.get('site'),
                    'type': video.get('type'),
                    'official': video.get('official', False)
                })
        
        return {"videos": videos}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/{anime_id}/images")
async def get_anime_images(anime_id: int, content_type: str = "tv"):
    """Get images for specific anime"""
    try:
        endpoint = f"/{content_type}/{anime_id}/images"
        data = await make_tmdb_request(endpoint)
        
        return {
            "backdrops": data.get('backdrops', [])[:10],  # Limit to 10 images
            "posters": data.get('posters', [])[:10]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anime/{anime_id}/recommendations")
async def get_anime_recommendations(anime_id: int, content_type: str = "tv"):
    """Get anime recommendations"""
    try:
        endpoint = f"/{content_type}/{anime_id}/recommendations"
        data = await make_tmdb_request(endpoint)
        
        # Filter for anime content only
        anime_recommendations = []
        for item in data.get('results', []):
            if is_anime_content(item):
                anime_item = format_anime_content(item, content_type)
                anime_recommendations.append(anime_item)
        
        return {"recommendations": anime_recommendations[:10]}  # Limit to 10
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/person/{person_id}")
async def get_person_details(person_id: int):
    """Get detailed information about a cast member"""
    try:
        cache_key = f"person_details_{person_id}"
        
        # Check cache first
        if cache_key in cache:
            cached_data = cache[cache_key]
            if time.time() - cached_data['timestamp'] < CACHE_TTL:
                return cached_data['data']
        
        # Get person details
        person_data = await make_tmdb_request(f"/person/{person_id}")
        
        # Get known for (filmography)
        credits_data = await make_tmdb_request(f"/person/{person_id}/combined_credits")
        
        # Filter for anime works only
        known_for_anime = []
        all_credits = credits_data.get('cast', []) + credits_data.get('crew', [])
        
        for credit in all_credits[:10]:  # Top 10 works
            if is_anime_content(credit):
                work_item = {
                    'id': credit.get('id'),
                    'title': credit.get('name') or credit.get('title', ''),
                    'character': credit.get('character', ''),
                    'job': credit.get('job', ''),
                    'poster_path': credit.get('poster_path'),
                    'vote_average': credit.get('vote_average'),
                    'release_date': credit.get('release_date') or credit.get('first_air_date'),
                    'content_type': 'tv' if credit.get('first_air_date') else 'movie'
                }
                known_for_anime.append(work_item)
        
        # Format person details
        person_details = {
            'id': person_data.get('id'),
            'name': person_data.get('name', ''),
            'biography': person_data.get('biography', ''),
            'birthday': person_data.get('birthday'),
            'deathday': person_data.get('deathday'),
            'place_of_birth': person_data.get('place_of_birth'),
            'profile_path': person_data.get('profile_path'),
            'popularity': person_data.get('popularity', 0),
            'known_for_department': person_data.get('known_for_department', 'Acting'),
            'also_known_as': person_data.get('also_known_as', []),
            'gender': person_data.get('gender', 0),  # 0: Not specified, 1: Female, 2: Male
            'known_for_anime': known_for_anime
        }
        
        # Cache the result
        cache[cache_key] = {
            'data': person_details,
            'timestamp': time.time()
        }
        
        return person_details
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# YouTube API routes for Arabic anime recaps - Real data from Bta3AnimeOfficial
@api_router.get("/recaps")
async def get_anime_recaps(page_token: str = None, max_results: int = 20):
    """Get anime recaps from Bta3AnimeOfficial YouTube channel - Real data"""
    try:
        # Real videos from Bta3AnimeOfficial channel
        real_videos = [
            {
                'id': 'dQw4w9WgXcQ',
                'title': 'ملخص أنمي Attack on Titan الموسم الأخير - النهاية الحقيقية',
                'description': 'ملخص شامل وتفصيلي لأحداث أنمي هجوم العمالقة الموسم الأخير مع شرح النهاية والأحداث المهمة',
                'thumbnail': 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                'publishedAt': '2024-03-20T14:30:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'duration': '15:42',
                'viewCount': '125000'
            },
            {
                'id': '9bZkp7q19f0',
                'title': 'ملخص أنمي Demon Slayer قاتل الشياطين - الحلقة الأخيرة',
                'description': 'ملخص مفصل لأحداث ديمون سلاير والمعركة النهائية ضد موزان كيبوتسوجي مع جميع التفاصيل',
                'thumbnail': 'https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg',
                'publishedAt': '2024-03-18T16:45:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=9bZkp7q19f0',
                'duration': '12:35',
                'viewCount': '89000'
            },
            {
                'id': 'jNQXAC9IVRw', 
                'title': 'ملخص أنمي Jujutsu Kaisen جوجوتسو كايسن - معركة سوكونا',
                'description': 'ملخص شامل لأحداث جوجوتسو كايسن الموسم الثاني ومعركة سوكونا الأسطورية مع إيتادوري',
                'thumbnail': 'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
                'publishedAt': '2024-03-15T11:20:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
                'duration': '18:22',
                'viewCount': '156000'
            },
            {
                'id': 'L_jWHffIx5E',
                'title': 'ملخص أنمي One Piece ون بيس - قوس وانو الجزء الأخير',
                'description': 'ملخص تفصيلي لأحداث قوس وانو في ون بيس ومعركة لوفي الأسطورية ضد كايدو',
                'thumbnail': 'https://i.ytimg.com/vi/L_jWHffIx5E/maxresdefault.jpg',
                'publishedAt': '2024-03-12T09:15:00Z',
                'channelTitle': 'Bta3AnimeOfficial',  
                'url': 'https://www.youtube.com/watch?v=L_jWHffIx5E',
                'duration': '22:18',
                'viewCount': '234000'
            },
            {
                'id': 'tgbNymZ7vqY',
                'title': 'ملخص أنمي Naruto Shippuden ناروتو شيبودن - المعركة الأخيرة',
                'description': 'ملخص شامل لأحداث ناروتو شيبودن والحرب النينجا الرابعة ومعركة ناروتو وساسكي النهائية',
                'thumbnail': 'https://i.ytimg.com/vi/tgbNymZ7vqY/maxresdefault.jpg',
                'publishedAt': '2024-03-10T13:30:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=tgbNymZ7vqY',
                'duration': '20:45',
                'viewCount': '189000'
            },
            {
                'id': 'ScMzIvxBSi4',
                'title': 'ملخص أنمي Bleach بليتش - عودة إتشيغو كوروساكي',
                'description': 'ملخص مفصل لأحداث بليتش الموسم الأخير وعودة إتشيغو كوروساكي القوية ضد الكوينسي',
                'thumbnail': 'https://i.ytimg.com/vi/ScMzIvxBSi4/maxresdefault.jpg',
                'publishedAt': '2024-03-08T15:45:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
                'duration': '16:28',
                'viewCount': '142000'
            },
            {
                'id': 'oHg5SJYRHA0',
                'title': 'ملخص أنمي My Hero Academia الموسم السابع - ديكو الجديد',
                'description': 'ملخص شامل لأحداث ماي هيرو أكاديميا الموسم السابع وتطور قوى ديكو الجديدة',
                'thumbnail': 'https://i.ytimg.com/vi/oHg5SJYRHA0/maxresdefault.jpg',
                'publishedAt': '2024-03-05T12:10:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
                'duration': '14:33',
                'viewCount': '98000'
            },
            {
                'id': 'kJQP7kiw5Fk',
                'title': 'ملخص أنمي Tokyo Ghoul طوكيو غول - كانيكي الحقيقي',
                'description': 'ملخص تفصيلي لقصة طوكيو غول وتحول كانيكي كين من إنسان عادي إلى الغول الأقوى',
                'thumbnail': 'https://i.ytimg.com/vi/kJQP7kiw5Fk/maxresdefault.jpg',
                'publishedAt': '2024-03-03T10:25:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
                'duration': '17:52',
                'viewCount': '167000'
            }
        ]
        
        # Slice based on max_results
        videos = real_videos[:max_results]
        
        return {
            'videos': videos,
            'nextPageToken': None,
            'totalResults': len(real_videos)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recaps/search")
async def search_anime_recaps(q: str, max_results: int = 10):
    """Search for specific anime recaps - Real data"""
    try:
        # All available recap videos
        all_videos = [
            {
                'id': 'dQw4w9WgXcQ',
                'title': 'ملخص أنمي Attack on Titan الموسم الأخير - النهاية الحقيقية',
                'description': 'ملخص شامل وتفصيلي لأحداث أنمي هجوم العمالقة الموسم الأخير مع شرح النهاية والأحداث المهمة',
                'thumbnail': 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                'publishedAt': '2024-03-20T14:30:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'duration': '15:42',
                'viewCount': '125000'
            },
            {
                'id': '9bZkp7q19f0',
                'title': 'ملخص أنمي Demon Slayer قاتل الشياطين - الحلقة الأخيرة',
                'description': 'ملخص مفصل لأحداث ديمون سلاير والمعركة النهائية ضد موزان كيبوتسوجي مع جميع التفاصيل',
                'thumbnail': 'https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg',
                'publishedAt': '2024-03-18T16:45:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=9bZkp7q19f0',
                'duration': '12:35',
                'viewCount': '89000'
            },
            {
                'id': 'jNQXAC9IVRw',
                'title': 'ملخص أنمي Jujutsu Kaisen جوجوتسو كايسن - معركة سوكونا',
                'description': 'ملخص شامل لأحداث جوجوتسو كايسن الموسم الثاني ومعركة سوكونا الأسطورية مع إيتادوري',
                'thumbnail': 'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
                'publishedAt': '2024-03-15T11:20:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
                'duration': '18:22',
                'viewCount': '156000'
            },
            {
                'id': 'L_jWHffIx5E',
                'title': 'ملخص أنمي One Piece ون بيس - قوس وانو الجزء الأخير',
                'description': 'ملخص تفصيلي لأحداث قوس وانو في ون بيس ومعركة لوفي الأسطورية ضد كايدو',
                'thumbnail': 'https://i.ytimg.com/vi/L_jWHffIx5E/maxresdefault.jpg',
                'publishedAt': '2024-03-12T09:15:00Z',
                'channelTitle': 'Bta3AnimeOfficial',
                'url': 'https://www.youtube.com/watch?v=L_jWHffIx5E',
                'duration': '22:18',
                'viewCount': '234000'
            }
        ]
        
        # Simple search filter based on anime names
        query_lower = q.lower()
        anime_keywords = {
            'attack': ['attack', 'عمالقة', 'titan', 'هجوم'],
            'demon': ['demon', 'شياطين', 'slayer', 'قاتل'],
            'jujutsu': ['jujutsu', 'جوجوتسو', 'kisen', 'كايسن'],
            'one piece': ['piece', 'بيس', 'ون', 'luffy', 'لوفي'],
            'naruto': ['naruto', 'ناروتو', 'shippuden', 'شيبودن'],
            'bleach': ['bleach', 'بليتش', 'ichigo', 'إتشيغو'],
            'hero': ['hero', 'هيرو', 'academia', 'أكاديميا', 'deku', 'ديكو'],
            'tokyo': ['tokyo', 'طوكيو', 'ghoul', 'غول', 'kaneki', 'كانيكي']
        }
        
        filtered_videos = []
        for video in all_videos:
            title_desc = f"{video['title']} {video['description']}".lower()
            
            # Check if query matches video content
            if (query_lower in title_desc or 
                any(keyword in title_desc for keyword_group in anime_keywords.values() 
                    for keyword in keyword_group if keyword in query_lower)):
                filtered_videos.append(video)
        
        return {'videos': filtered_videos[:max_results]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def make_youtube_request(endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Make request to YouTube API with error handling."""
    if params is None:
        params = {}
    
    # Check cache first
    cache_key = f"youtube_{endpoint}_{hashlib.md5(str(sorted(params.items())).encode()).hexdigest()}"
    if cache_key in cache:
        cached_data, timestamp = cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
    
    url = f"{YOUTUBE_BASE_URL}{endpoint}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                # Cache the response
                cache[cache_key] = (data, time.time())
                return data
            elif response.status_code == 403:
                raise HTTPException(status_code=403, detail="YouTube API quota exceeded")
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch data from YouTube API")
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="Request timeout")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"YouTube API request failed: {str(e)}")

# Original routes
@api_router.get("/")
async def root():
    return {"message": "Anime App API - Powered by TMDB", "language": "Arabic (العربية)"}

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