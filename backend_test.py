#!/usr/bin/env python3
"""
Backend API Testing for MyAnimeList-like App
Tests all anime API endpoints using the Jikan API integration
"""

import requests
import json
import time
from typing import Dict, Any, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://anime-autofeed.preview.emergentagent.com')
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
        """Test top anime endpoint - MOST IMPORTANT"""
        try:
            response = self.session.get(f"{API_BASE}/anime/top")
            if response.status_code == 200:
                data = response.json()
                if "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
                    # Check first anime structure
                    first_anime = data["data"][0]
                    required_fields = ["mal_id", "title", "images"]
                    missing_fields = [field for field in required_fields if field not in first_anime]
                    
                    if not missing_fields:
                        self.log_result("GET /api/anime/top", "PASS", 
                                      f"Retrieved {len(data['data'])} top anime successfully", 
                                      {"sample_anime": first_anime["title"], "total_count": len(data["data"])})
                        return True
                    else:
                        self.log_result("GET /api/anime/top", "FAIL", 
                                      f"Missing required fields in anime data: {missing_fields}")
                        return False
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
                    if "data" in data and isinstance(data["data"], list):
                        if len(data["data"]) > 0:
                            first_result = data["data"][0]
                            self.log_result(f"GET /api/anime/search?q={query}", "PASS", 
                                          f"Found {len(data['data'])} results for '{query}'", 
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
        # Test with One Piece (ID: 1) as mentioned in requirements
        anime_ids = [1, 20, 16498]  # One Piece, Naruto, Attack on Titan
        
        for anime_id in anime_ids:
            try:
                response = self.session.get(f"{API_BASE}/anime/{anime_id}")
                if response.status_code == 200:
                    data = response.json()
                    if "data" in data and isinstance(data["data"], dict):
                        anime_data = data["data"]
                        if "mal_id" in anime_data and "title" in anime_data:
                            self.log_result(f"GET /api/anime/{anime_id}", "PASS", 
                                          f"Retrieved details for '{anime_data['title']}'", 
                                          {"title": anime_data["title"], "mal_id": anime_data["mal_id"]})
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
        """Test current season anime endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/anime/current-season")
            if response.status_code == 200:
                data = response.json()
                if "data" in data and isinstance(data["data"], list):
                    self.log_result("GET /api/anime/current-season", "PASS", 
                                  f"Retrieved {len(data['data'])} currently airing anime", 
                                  {"count": len(data["data"])})
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
                if "data" in data and len(data["data"]) <= 10:
                    self.log_result("PAGINATION TEST: /api/anime/top", "PASS", 
                                  f"Pagination working - got {len(data['data'])} items with limit=10")
                    return True
                else:
                    self.log_result("PAGINATION TEST: /api/anime/top", "FAIL", 
                                  f"Pagination not working properly - got {len(data.get('data', []))} items")
                    return False
            else:
                self.log_result("PAGINATION TEST: /api/anime/top", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("PAGINATION TEST: /api/anime/top", "ERROR", f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print(f"Starting API tests for backend: {API_BASE}")
        print("=" * 60)
        
        test_functions = [
            ("Root Endpoint", self.test_root_endpoint),
            ("Top Anime (PRIORITY)", self.test_top_anime),
            ("Search Anime (PRIORITY)", self.test_search_anime),
            ("Anime Details", self.test_anime_details),
            ("Current Season", self.test_current_season),
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