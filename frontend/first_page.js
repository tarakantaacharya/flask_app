async function fetchSuggestions() {
    const query = document.getElementById('search-input').value.trim();
    const suggestionBox = document.getElementById('suggestion-box');
    
    if (!query) {
        suggestionBox.style.display = 'none';
        return;
    }

    try {
        // Build URL with proper parameter checks
        const baseUrl = `https://big-crow-450507-n4.uc.r.appspot.com/restaurants/names?search=${encodeURIComponent(query)}`;
        const url = userLocation && userLocation.latitude && userLocation.longitude
            ? `${baseUrl}&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`
            : baseUrl;

        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        suggestionBox.innerHTML = '';

        if (data.restaurants?.length > 0) {
            data.restaurants.forEach(suggestion => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = suggestion;
                div.onclick = () => goToDetailsPage(suggestion);
                suggestionBox.appendChild(div);
            });
            suggestionBox.style.display = 'block';
        } else {
            suggestionBox.style.display = 'none';
        }
    } catch (error) {
        console.error("Fetch suggestions error:", error);
        suggestionBox.style.display = 'none';
    }
}

        // Close suggestion box when clicking outside
        document.addEventListener('click', function(event) {
            const suggestionBox = document.getElementById('suggestion-box');
            const searchInput = document.getElementById('search-input');

            if (!searchInput.contains(event.target) && !suggestionBox.contains(event.target)) {
                suggestionBox.style.display = 'none';
            }
        });

        // Close suggestion box when input is cleared
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', function() {
            if (this.value.trim() === '') {
                suggestionBox.style.display = 'none';
            }
        });

        function goToDetailsPage(restaurantName) {
            const encodedName = encodeURIComponent(restaurantName);
            window.location.href = `restaurant_details.html?name=${encodedName}`;
        }

        function searchRestaurants() {
            const searchTerm = document.getElementById("search-input").value.trim();
            if (searchTerm.length > 0) {
                window.location.href = `search_results.html?query=${encodeURIComponent(searchTerm)}&latitude=${userLocation?.latitude}&longitude=${userLocation?.longitude}`;
            }
        }

        let locationEnabled = false;
let userLocation = null;
let nearbyRestaurantsDB = [];
let mainRestaurantsDB = [];
let isLoading = false;

// Toggle location with enhanced handling
async function toggleLocation() {
    const locationBtn = document.getElementById("location-btn");
    
    try {
        if (!locationEnabled) {
            // Step 1: Show loading state
            locationBtn.disabled = true;
            locationBtn.textContent = "Detecting Location...";
            showLoading(true);

            // Step 2: Get location
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            // Step 3: Redirect to location results page
            window.location.href = `location.html?lat=${
                position.coords.latitude
            }&lon=${
                position.coords.longitude
            }&ts=${Date.now()}`; // Cache buster

        } else {
            // Step 4: Handle location off
            resetLocationState();
            displayRestaurants(mainRestaurantsDB, false);
        }
    } catch (error) {
        console.error("Location Error:", error);
        displayMessage(error.message.includes("denied") ? 
            "Location access denied. Showing main list." : 
            "Failed to get location. Try again.");
        resetLocationState();
    } finally {
        // Step 5: Reset UI states
        locationBtn.disabled = false;
        showLoading(false);
        if (!locationEnabled) {
            locationBtn.textContent = "Location Off";
        }
    }
}

// New helper function
function resetLocationState() {
    locationEnabled = false;
    userLocation = null;
    nearbyRestaurantsDB = [];
    const locationBtn = document.getElementById("location-btn");
    locationBtn.classList.replace("btn-success", "btn-secondary");
    locationBtn.textContent = "Location Off";
}

// Enhanced fetch function
async function fetchNearbyRestaurants(lat, lon) {
    try {
        const response = await fetch(
            `https://big-crow-450507-n4.uc.r.appspot.com/fetch_nearby_restaurants?lat=${lat}&lon=${lon}`
        );
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        // Handle different response formats
        if (Array.isArray(data)) return data;
        if (data.restaurants) return data.restaurants;
        return [];
        
    } catch (error) {
        console.error("Fetch error:", error);
        displayMessage("Failed to fetch nearby restaurants");
        return [];
    }
}

// Improved display function
function displayRestaurants(restaurants, isNearby) {
    const restaurantList = document.getElementById('restaurant-list');
    restaurantList.innerHTML = '';
    
    if (restaurants.length === 0) {
        displayMessage(isNearby ? 
            "No restaurants found nearby" : 
            "No restaurants available");
        return;
    }
    
    restaurants.forEach(restaurant => {
        const div = document.createElement('div');
        div.className = 'restaurant-item card mb-3';
        div.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${restaurant.Restaurant_Name}</h5>
                <p class="card-text">
                    ${restaurant.Address}<br>
                    <small class="text-muted">${restaurant.Cuisines}</small>
                </p>
                ${isNearby ? `
                <div class="restaurant-meta">
                    <span class="badge bg-primary">${restaurant.Aggregate_rating || 'N/A'} ★</span>
                    ${restaurant.Distance_km ? 
                    `<span class="badge bg-secondary">${restaurant.Distance_km}km</span>` : ''}
                </div>` : ''}
            </div>
        `;
        restaurantList.appendChild(div);
    });
}

// New helper functions
function showLoading(show) {
    const spinner = document.getElementById('loading-spinner');
    const mainContent = document.getElementById('main-container');
    if (show) {
        spinner.style.display = 'block';
        mainContent.style.opacity = '0.5';
    } else {
        spinner.style.display = 'none';
        mainContent.style.opacity = '1';
    }
}

function displayMessage(message) {
    const restaurantList = document.getElementById('restaurant-list');
    restaurantList.innerHTML = `
        <div class="alert alert-info mt-3">
            ${message}
        </div>
    `;
}

function resetLocationState() {
    const locationBtn = document.getElementById("location-btn");
    locationEnabled = false;
    userLocation = null;
    nearbyRestaurantsDB = [];
    locationBtn.classList.replace("btn-success", "btn-secondary");
    locationBtn.textContent = "Location Off";
}

// Initial load with error handling
async function fetchMainRestaurants() {
    try {
        showLoading(true);
        const response = await fetch('/restaurants');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        mainRestaurantsDB = data.restaurants || [];
        displayRestaurants(mainRestaurantsDB, false);
        
    } catch (error) {
        console.error("Fetch error:", error);
    } finally {
        showLoading(false);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchMainRestaurants();
    document.getElementById('location-btn').addEventListener('click', toggleLocation);
});


async function analyzeImage() {
    const fileInput = document.getElementById("imageInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an image.");
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch("https://big-crow-450507-n4.uc.r.appspot.com/analyze-image", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data?.cuisine) {
            const detectedCuisine = data.cuisine;
            window.location.href = `search_results.html?query=${encodeURIComponent(detectedCuisine)}&latitude=${userLocation?.latitude}&longitude=${userLocation?.longitude}`; 
        } else {
            alert("Could not recognize the image. Try another one.");
        }
    } catch (error) {
        console.error("Error analyzing image:", error);
        alert("An error occurred. Please try again later.");
    }
}
