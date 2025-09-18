#!/usr/bin/env python3
"""
Backend API Testing for MyAnimeList-like App
Tests all anime API endpoints focusing on Arabic/English titles and Fall 2025 content
"""

import requests
import json
import time
from typing import Dict, Any, List
import os
from dotenv import load_dotenv
import re

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL - use localhost since we're testing internally
BACKEND_URL = 'http://localhost:8001'
API_BASE = f"{BACKEND_URL}/api"

class AnimeAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = 30
        self.results = []
        
    def log_result(self, endpoint: str, status: str, details: str, response_data: Any = None):
        """Log test result"""
        result = {
            'endpoint': endpoint,
            'status': status,
            'details': details,
            'response_data': response_data
        }
        self.results.append(result)
        print(f"[{status}] {endpoint}: {details}")
        
    def test_root_endpoint(self):
        """Test basic root endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Anime App API" in data["message"]:
                    self.log_result("GET /api/", "PASS", "Root endpoint working correctly", data)
                    return True
                else:
                    self.log_result("GET /api/", "FAIL", f"Unexpected response format: {data}")
                    return False
            else:
                self.log_result("GET /api/", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("GET /api/", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_top_anime(self):
        """Test top anime endpoint - should return anime with Arabic titles when available, English titles otherwise, NEVER Japanese"""
        try:
            response = self.session.get(f"{API_BASE}/anime/top")
            if response.status_code == 200:
                data = response.json()
                if "results" in data and isinstance(data["results"], list) and len(data["results"]) > 0:
                    # Check first anime structure
                    first_anime = data["results"][0]
                    required_fields = ["id", "title", "poster_path"]
                    missing_fields = [field for field in required_fields if field not in first_anime]
                    
                    if missing_fields:
                        self.log_result("GET /api/anime/top", "FAIL", 
                                      f"Missing required fields in anime data: {missing_fields}")
                        return False
                    
                    # Check title language requirements
                    title_issues = []
                    for anime in data["results"][:5]:  # Check first 5 anime
                        title = anime.get("title", "")
                        title_arabic = anime.get("title_arabic", "")
                        
                        # Check if title contains Japanese characters (should NOT)
                        if re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', title):
                            title_issues.append(f"Japanese characters found in title: {title}")
                        
                        # Title should be Arabic or English, not empty
                        if not title and not title_arabic:
                            title_issues.append(f"Both title and title_arabic are empty for anime ID {anime.get('id')}")
                    
                    if title_issues:
                        self.log_result("GET /api/anime/top", "FAIL", 
                                      f"Title language issues: {'; '.join(title_issues[:3])}")
                        return False
                    
                    self.log_result("GET /api/anime/top", "PASS", 
                                  f"Retrieved {len(data['results'])} top anime with proper Arabic/English titles", 
                                  {"sample_anime": first_anime["title"], "total_count": len(data["results"])})
                    return True
                else:
                    self.log_result("GET /api/anime/top", "FAIL", 
                                  f"Invalid response structure: {data}")
                    return False
            else:
                self.log_result("GET /api/anime/top", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("GET /api/anime/top", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_search_anime(self):
        """Test anime search endpoint - CORE FEATURE"""
        test_queries = ["naruto", "one piece", "attack on titan"]
        
        for query in test_queries:
            try:
                response = self.session.get(f"{API_BASE}/anime/search", params={"q": query})
                if response.status_code == 200:
                    data = response.json()
                    if "results" in data and isinstance(data["results"], list):
                        if len(data["results"]) > 0:
                            first_result = data["results"][0]
                            self.log_result(f"GET /api/anime/search?q={query}", "PASS", 
                                          f"Found {len(data['results'])} results for '{query}'", 
                                          {"first_result": first_result.get("title", "Unknown")})
                        else:
                            self.log_result(f"GET /api/anime/search?q={query}", "WARN", 
                                          f"No results found for '{query}' (might be valid)")
                    else:
                        self.log_result(f"GET /api/anime/search?q={query}", "FAIL", 
                                      f"Invalid response structure: {data}")
                        return False
                else:
                    self.log_result(f"GET /api/anime/search?q={query}", "FAIL", 
                                  f"HTTP {response.status_code}: {response.text}")
                    return False
                    
                # Add delay to respect rate limits
                time.sleep(1)
                
            except Exception as e:
                self.log_result(f"GET /api/anime/search?q={query}", "ERROR", 
                              f"Request failed: {str(e)}")
                return False
        
        return True
    
    def test_anime_details(self):
        """Test specific anime details endpoint"""
        # Test with popular anime IDs from TMDB
        anime_ids = [207468, 95479, 46260]  # Monster #8, Jujutsu Kaisen, Naruto
        
        for anime_id in anime_ids:
            try:
                response = self.session.get(f"{API_BASE}/anime/{anime_id}")
                if response.status_code == 200:
                    data = response.json()
                    if "data" in data and isinstance(data["data"], dict):
                        anime_data = data["data"]
                        if "id" in anime_data and "title" in anime_data:
                            self.log_result(f"GET /api/anime/{anime_id}", "PASS", 
                                          f"Retrieved details for '{anime_data['title']}'", 
                                          {"title": anime_data["title"], "id": anime_data["id"]})
                        else:
                            self.log_result(f"GET /api/anime/{anime_id}", "FAIL", 
                                          "Missing required fields in anime details")
                            return False
                    else:
                        self.log_result(f"GET /api/anime/{anime_id}", "FAIL", 
                                      f"Invalid response structure: {data}")
                        return False
                elif response.status_code == 404:
                    self.log_result(f"GET /api/anime/{anime_id}", "WARN", 
                                  f"Anime ID {anime_id} not found (might be valid)")
                else:
                    self.log_result(f"GET /api/anime/{anime_id}", "FAIL", 
                                  f"HTTP {response.status_code}: {response.text}")
                    return False
                    
                # Add delay to respect rate limits
                time.sleep(1)
                
            except Exception as e:
                self.log_result(f"GET /api/anime/{anime_id}", "ERROR", 
                              f"Request failed: {str(e)}")
                return False
        
        return True
    
    def test_current_season(self):
        """Test current season anime endpoint - should return Fall 2025 anime ONLY (September-December 2025)"""
        try:
            response = self.session.get(f"{API_BASE}/anime/current-season")
            if response.status_code == 200:
                data = response.json()
                if "results" in data and isinstance(data["results"], list):
                    # Check if anime are from Fall 2025 (Sept-Dec 2025)
                    fall_2025_issues = []
                    for anime in data["results"][:5]:  # Check first 5 anime
                        air_date = anime.get("first_air_date") or anime.get("release_date", "")
                        if air_date:
                            # Check if date is in Fall 2025 range (2025-09-01 to 2025-12-31)
                            if not (air_date >= "2025-09-01" and air_date <= "2025-12-31"):
                                fall_2025_issues.append(f"Anime '{anime.get('title', 'Unknown')}' has air date {air_date} (not Fall 2025)")
                    
                    if fall_2025_issues:
                        self.log_result("GET /api/anime/current-season", "FAIL", 
                                      f"Non-Fall 2025 anime found: {'; '.join(fall_2025_issues[:2])}")
                        return False
                    
                    self.log_result("GET /api/anime/current-season", "PASS", 
                                  f"Retrieved {len(data['results'])} Fall 2025 anime correctly", 
                                  {"count": len(data["results"])})
                    return True
                else:
                    self.log_result("GET /api/anime/current-season", "FAIL", 
                                  f"Invalid response structure: {data}")
                    return False
            else:
                self.log_result("GET /api/anime/current-season", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("GET /api/anime/current-season", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_seasonal_anime(self):
        """Test seasonal anime endpoint"""
        # Test current season (2025 winter) as mentioned in requirements
        seasons = [
            {"year": 2025, "season": "winter"},
            {"year": 2024, "season": "fall"},
            {"year": 2024, "season": "summer"}
        ]
        
        for season_data in seasons:
            year = season_data["year"]
            season = season_data["season"]
            
            try:
                response = self.session.get(f"{API_BASE}/anime/seasonal/{year}/{season}")
                if response.status_code == 200:
                    data = response.json()
                    if "data" in data and isinstance(data["data"], list):
                        self.log_result(f"GET /api/anime/seasonal/{year}/{season}", "PASS", 
                                      f"Retrieved {len(data['data'])} anime for {season} {year}", 
                                      {"count": len(data["data"])})
                    else:
                        self.log_result(f"GET /api/anime/seasonal/{year}/{season}", "FAIL", 
                                      f"Invalid response structure: {data}")
                        return False
                else:
                    self.log_result(f"GET /api/anime/seasonal/{year}/{season}", "FAIL", 
                                  f"HTTP {response.status_code}: {response.text}")
                    return False
                    
                # Add delay to respect rate limits
                time.sleep(1)
                
            except Exception as e:
                self.log_result(f"GET /api/anime/seasonal/{year}/{season}", "ERROR", 
                              f"Request failed: {str(e)}")
                return False
        
        return True
    
    def test_anime_genres(self):
        """Test anime genres endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/anime/genres")
            if response.status_code == 200:
                data = response.json()
                if "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
                    self.log_result("GET /api/anime/genres", "PASS", 
                                  f"Retrieved {len(data['data'])} anime genres", 
                                  {"sample_genres": [g.get("name", "Unknown") for g in data["data"][:5]]})
                    return True
                else:
                    self.log_result("GET /api/anime/genres", "FAIL", 
                                  f"Invalid response structure or empty data: {data}")
                    return False
            else:
                self.log_result("GET /api/anime/genres", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("GET /api/anime/genres", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_error_handling(self):
        """Test error handling scenarios"""
        error_tests = [
            {"endpoint": f"{API_BASE}/anime/999999", "description": "Invalid anime ID"},
            {"endpoint": f"{API_BASE}/anime/seasonal/2025/invalid", "description": "Invalid season name"},
            {"endpoint": f"{API_BASE}/anime/seasonal/1900/winter", "description": "Very old year"}
        ]
        
        for test in error_tests:
            try:
                response = self.session.get(test["endpoint"])
                if response.status_code in [400, 404, 422]:
                    self.log_result(f"ERROR TEST: {test['description']}", "PASS", 
                                  f"Properly handled error with HTTP {response.status_code}")
                elif response.status_code == 200:
                    self.log_result(f"ERROR TEST: {test['description']}", "WARN", 
                                  "Request succeeded when error was expected")
                else:
                    self.log_result(f"ERROR TEST: {test['description']}", "FAIL", 
                                  f"Unexpected HTTP {response.status_code}: {response.text}")
                    
                # Add delay to respect rate limits
                time.sleep(1)
                
            except Exception as e:
                self.log_result(f"ERROR TEST: {test['description']}", "ERROR", 
                              f"Request failed: {str(e)}")
        
        return True
    
    def test_pagination(self):
        """Test pagination parameters"""
        try:
            # Test pagination on top anime
            response = self.session.get(f"{API_BASE}/anime/top", params={"page": 1, "limit": 10})
            if response.status_code == 200:
                data = response.json()
                if "results" in data and len(data["results"]) <= 10:
                    self.log_result("PAGINATION TEST: /api/anime/top", "PASS", 
                                  f"Pagination working - got {len(data['results'])} items with limit=10")
                    return True
                else:
                    self.log_result("PAGINATION TEST: /api/anime/top", "FAIL", 
                                  f"Pagination not working properly - got {len(data.get('results', []))} items")
                    return False
            else:
                self.log_result("PAGINATION TEST: /api/anime/top", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("PAGINATION TEST: /api/anime/top", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_anime_movies(self):
        """Test anime movies endpoint - should return anime movies with proper Arabic/English titles"""
        try:
            response = self.session.get(f"{API_BASE}/anime/movies")
            if response.status_code == 200:
                data = response.json()
                if "results" in data and isinstance(data["results"], list) and len(data["results"]) > 0:
                    # Check movie structure and titles
                    first_movie = data["results"][0]
                    required_fields = ["id", "title", "poster_path", "content_type"]
                    missing_fields = [field for field in required_fields if field not in first_movie]
                    
                    if missing_fields:
                        self.log_result("GET /api/anime/movies", "FAIL", 
                                      f"Missing required fields in movie data: {missing_fields}")
                        return False
                    
                    # Check if content_type is movie
                    if first_movie.get("content_type") != "movie":
                        self.log_result("GET /api/anime/movies", "FAIL", 
                                      f"Expected content_type 'movie', got '{first_movie.get('content_type')}'")
                        return False
                    
                    # Check title language requirements (same as top anime)
                    title_issues = []
                    for movie in data["results"][:3]:  # Check first 3 movies
                        title = movie.get("title", "")
                        if re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', title):
                            title_issues.append(f"Japanese characters found in movie title: {title}")
                    
                    if title_issues:
                        self.log_result("GET /api/anime/movies", "FAIL", 
                                      f"Title language issues: {'; '.join(title_issues)}")
                        return False
                    
                    self.log_result("GET /api/anime/movies", "PASS", 
                                  f"Retrieved {len(data['results'])} anime movies with proper titles", 
                                  {"sample_movie": first_movie["title"], "total_count": len(data["results"])})
                    return True
                else:
                    self.log_result("GET /api/anime/movies", "FAIL", 
                                  f"Invalid response structure or no movies: {data}")
                    return False
            else:
                self.log_result("GET /api/anime/movies", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("GET /api/anime/movies", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_anime_details_enhanced(self):
        """Test enhanced anime details endpoint - should return detailed info with cast, genres in Arabic, recommendations, and ratings"""
        # Test with a known anime ID from TMDB
        anime_id = 65930  # Attack on Titan (popular anime)
        
        try:
            response = self.session.get(f"{API_BASE}/anime/{anime_id}/details", params={"content_type": "tv"})
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields for detailed anime info
                required_fields = ["id", "title", "overview", "genres", "cast", "recommendations", "vote_average", "audience_rating"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(f"GET /api/anime/{anime_id}/details", "FAIL", 
                                  f"Missing required fields in detailed anime data: {missing_fields}")
                    return False
                
                # Check if genres have Arabic translations
                genres = data.get("genres", [])
                if genres and isinstance(genres, list):
                    first_genre = genres[0]
                    if "name_arabic" not in first_genre:
                        self.log_result(f"GET /api/anime/{anime_id}/details", "FAIL", 
                                      "Genres missing Arabic translations (name_arabic field)")
                        return False
                
                # Check if cast is present and has proper structure
                cast = data.get("cast", [])
                if cast and isinstance(cast, list):
                    first_cast = cast[0]
                    cast_required = ["id", "name", "character"]
                    cast_missing = [field for field in cast_required if field not in first_cast]
                    if cast_missing:
                        self.log_result(f"GET /api/anime/{anime_id}/details", "FAIL", 
                                      f"Cast missing required fields: {cast_missing}")
                        return False
                
                # Check if both official and audience ratings are present
                official_rating = data.get("vote_average")
                audience_rating = data.get("audience_rating")
                if official_rating is None or audience_rating is None:
                    self.log_result(f"GET /api/anime/{anime_id}/details", "FAIL", 
                                  "Missing official rating or audience rating")
                    return False
                
                # Check recommendations
                recommendations = data.get("recommendations", [])
                if not isinstance(recommendations, list):
                    self.log_result(f"GET /api/anime/{anime_id}/details", "FAIL", 
                                  "Recommendations should be a list")
                    return False
                
                self.log_result(f"GET /api/anime/{anime_id}/details", "PASS", 
                              f"Retrieved detailed info for '{data['title']}' with cast, genres in Arabic, recommendations, and ratings", 
                              {
                                  "title": data["title"], 
                                  "genres_count": len(genres),
                                  "cast_count": len(cast),
                                  "recommendations_count": len(recommendations),
                                  "official_rating": official_rating,
                                  "audience_rating": audience_rating
                              })
                return True
            else:
                self.log_result(f"GET /api/anime/{anime_id}/details", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result(f"GET /api/anime/{anime_id}/details", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def test_person_details(self):
        """Test person details endpoint - should return person details with known anime works"""
        # Test with a known person ID from TMDB (voice actor/staff)
        person_id = 1325962  # A known person from anime
        
        try:
            response = self.session.get(f"{API_BASE}/person/{person_id}")
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields for person details
                required_fields = ["id", "name", "known_for_anime"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(f"GET /api/person/{person_id}", "FAIL", 
                                  f"Missing required fields in person data: {missing_fields}")
                    return False
                
                # Check if known_for_anime is present and structured correctly
                known_for_anime = data.get("known_for_anime", [])
                if not isinstance(known_for_anime, list):
                    self.log_result(f"GET /api/person/{person_id}", "FAIL", 
                                  "known_for_anime should be a list")
                    return False
                
                # If there are anime works, check their structure
                if known_for_anime:
                    first_work = known_for_anime[0]
                    work_required = ["id", "title"]
                    work_missing = [field for field in work_required if field not in first_work]
                    if work_missing:
                        self.log_result(f"GET /api/person/{person_id}", "FAIL", 
                                      f"Anime work missing required fields: {work_missing}")
                        return False
                
                self.log_result(f"GET /api/person/{person_id}", "PASS", 
                              f"Retrieved person details for '{data['name']}' with {len(known_for_anime)} known anime works", 
                              {
                                  "name": data["name"],
                                  "known_for_count": len(known_for_anime),
                                  "department": data.get("known_for_department", "Unknown")
                              })
                return True
            else:
                self.log_result(f"GET /api/person/{person_id}", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result(f"GET /api/person/{person_id}", "ERROR", f"Request failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print(f"Starting API tests for backend: {API_BASE}")
        print("=" * 60)
        
        test_functions = [
            ("Root Endpoint", self.test_root_endpoint),
            ("Top Anime (PRIORITY)", self.test_top_anime),
            ("Current Season Fall 2025 (PRIORITY)", self.test_current_season),
            ("Anime Movies (PRIORITY)", self.test_anime_movies),
            ("Enhanced Anime Details (PRIORITY)", self.test_anime_details_enhanced),
            ("Person Details (PRIORITY)", self.test_person_details),
            ("Search Anime", self.test_search_anime),
            ("Anime Details (Basic)", self.test_anime_details),
            ("Seasonal Anime", self.test_seasonal_anime),
            ("Anime Genres", self.test_anime_genres),
            ("Error Handling", self.test_error_handling),
            ("Pagination", self.test_pagination)
        ]
        
        passed = 0
        total = len(test_functions)
        
        for test_name, test_func in test_functions:
            print(f"\n--- Testing {test_name} ---")
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                print(f"Test {test_name} crashed: {str(e)}")
            
            # Rate limiting delay between test groups
            time.sleep(2)
        
        print("\n" + "=" * 60)
        print(f"TEST SUMMARY: {passed}/{total} test groups passed")
        print("=" * 60)
        
        # Print detailed results
        print("\nDETAILED RESULTS:")
        for result in self.results:
            status_symbol = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
            print(f"{status_symbol} {result['endpoint']}: {result['details']}")
        
        return passed, total, self.results

def main():
    """Main test execution"""
    tester = AnimeAPITester()
    passed, total, results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/test_results_backend.json', 'w') as f:
        json.dump({
            'summary': {'passed': passed, 'total': total},
            'results': results,
            'backend_url': API_BASE
        }, f, indent=2)
    
    print(f"\nResults saved to /app/test_results_backend.json")
    
    # Return exit code based on results
    critical_failures = [r for r in results if r['status'] == 'FAIL' and 'top' in r['endpoint'].lower()]
    if critical_failures:
        print("CRITICAL: Core anime endpoints failed!")
        return 1
    elif passed < total * 0.8:  # Less than 80% passed
        print("WARNING: Many tests failed")
        return 1
    else:
        print("SUCCESS: Most tests passed")
        return 0

if __name__ == "__main__":
    exit(main())