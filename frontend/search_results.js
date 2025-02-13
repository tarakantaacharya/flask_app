const API_URL = "https://big-crow-450507-n4.uc.r.appspot.com/restaurants";

        function getQueryParam(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        }

        async function fetchSearchResults(page = 1, callback) {
            let searchQuery = getQueryParam("query");
            if (!searchQuery) return;

            document.getElementById("loading").style.display = "block"; // Show loading
            document.getElementById("error-message").innerText = ""; // Clear previous error

            try {
                let url = `${API_URL}?page=${page}&per_page=9&search=${encodeURIComponent(searchQuery)}`;
                let response = await fetch(url);
                if (!response.ok) throw new Error("Failed to fetch results");

                let data = await response.json();
                callback(null, data);
            } catch (error) {
                callback(error, null);
            } finally {
                document.getElementById("loading").style.display = "none"; // Hide loading
            }
        }

        function displaySearchResults(error, data) {
            if (error) {
                console.error("Error fetching search results:", error);
                document.getElementById("error-message").innerText = "Error fetching results. Please try again.";
                return;
            }

            let resultList = document.getElementById("search-results");
            resultList.innerHTML = "";

            if (data.restaurants.length === 0) {
                resultList.innerHTML = "<p>No restaurants found.</p>";
                return;
            }

            data.restaurants.forEach(restaurant => {
                let cleanName = encodeURIComponent(restaurant.Restaurant_Name.trim());
                let div = document.createElement("div");
                div.className = "restaurant-card";
                div.innerHTML = `
                    <h3>${restaurant.Restaurant_Name}</h3>
                    <p><strong>Location:</strong> ${restaurant.City}, ${restaurant.Address}</p>
                    <p><strong>Cuisine:</strong> ${restaurant.Cuisines}</p>
                    <p><strong>Rating:</strong> ${restaurant.Aggregate_rating} ⭐</p>
                    <button onclick="navigateToDetails('${cleanName}')">View Details</button>
                `;
                resultList.appendChild(div);
            });

            updatePagination(data.pages, data.current_page);
        }

        function navigateToDetails(name) {
            window.location.href = `restaurant_details.html?name=${name}`;
        }

        function updatePagination(totalPages, currentPage) {
            let paginationDiv = document.getElementById("pagination");
            paginationDiv.innerHTML = "";

            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);

            for (let i = startPage; i <= endPage; i++) {
                let button = document.createElement("button");
                button.innerText = i;
                button.onclick = () => fetchSearchResults(i, displaySearchResults);
                if (i === currentPage) button.disabled = true;
                paginationDiv.appendChild(button);
            }

            if (endPage < totalPages) {
                let nextButton = document.createElement("button");
                nextButton.innerText = "Next";
                nextButton.onclick = () => fetchSearchResults(endPage + 1, displaySearchResults);
                paginationDiv.appendChild(nextButton);
            }
        }

        window.onload = () => fetchSearchResults(1, displaySearchResults);