from flask import Flask, jsonify, request
import requests
import pymysql
from flask_cors import CORS
import os
import base64
from db import get_db_connection

app = Flask(__name__)
CORS(app)


# API keys (check if they are loaded correctly)
GEO_API_KEY = os.getenv("GEO_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME")

# Check if any API keys are missing
if not GEO_API_KEY or not GEMINI_API_KEY or not GEMINI_MODEL_NAME:
    print("Error: Missing one or more API keys.")
    exit(1)


# ✅ Corrected API for fetching restaurant list (with pagination & search)
@app.route('/restaurants', methods=['GET'])
def get_restaurants():
    try:
        search_term = request.args.get('search', '', type=str)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 9, type=int)
        offset = (page - 1) * per_page

        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()

        # ✅ Fetch paginated list of restaurants
        cursor.execute("""
            SELECT Restaurant_ID, Restaurant_Name, City, Address, Locality, Cuisines, Rating_text, Country, Aggregate_rating, Latitude, Longitude
                       ,Average_Cost_for_two, Currency, Has_Table_booking, Has_Online_delivery, Is_delivering_now
            FROM zomato_new
            WHERE Restaurant_Name LIKE %s
            LIMIT %s OFFSET %s
        """, ('%' + search_term + '%', per_page, offset))

        restaurants = cursor.fetchall()

        # ✅ Fetch total count for pagination
        cursor.execute("SELECT COUNT(*) AS total FROM zomato_new WHERE Restaurant_Name LIKE %s", ('%' + search_term + '%',))
        total_records = cursor.fetchone()['total']

        cursor.close()
        connection.close()

        return jsonify({
            'restaurants': restaurants,
            'total': total_records,
            'pages': (total_records // per_page) + (1 if total_records % per_page > 0 else 0),
            'current_page': page
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ✅ Corrected API for fetching details of a single restaurant
@app.route('/restaurant', methods=['GET'])
def get_restaurant_details():
    try:
        restaurant_name = request.args.get('name', '', type=str)

        if not restaurant_name:
            return jsonify({"error": "Restaurant name is required"}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()

        # ✅ Fetch details of a single restaurant
        cursor.execute("""
            SELECT Restaurant_ID, Restaurant_Name, City, Address, Locality, Cuisines, Rating_text, Country, Aggregate_rating, Latitude, Longitude
            FROM zomato_new
            WHERE Restaurant_Name = %s
        """, (restaurant_name,))

        restaurant = cursor.fetchone()

        cursor.close()
        connection.close()

        if not restaurant:
            return jsonify({"error": "Restaurant not found"}), 404

        return jsonify(restaurant), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/restaurants/names', methods=['GET'])
def get_restaurant_names():
    try:
        search_term = request.args.get('search', '', type=str)
        latitude = request.args.get('latitude', type=float)
        longitude = request.args.get('longitude', type=float)

        # If location is enabled, use the temporary database
        if latitude is not None and longitude is not None:
            global temporary_restaurant_db
            filtered_restaurants = [
                restaurant for restaurant in temporary_restaurant_db
                if search_term.lower() in restaurant['Restaurant_Name'].lower()
            ]
            restaurant_names = [restaurant['Restaurant_Name'] for restaurant in filtered_restaurants]
            return jsonify({'restaurants': restaurant_names}), 200

        # Otherwise, connect to the main database
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        cursor.execute("SELECT Restaurant_Name FROM zomato_new WHERE Restaurant_Name LIKE %s LIMIT 10", ('%' + search_term + '%',))
        restaurant_names = [row['Restaurant_Name'] for row in cursor.fetchall()]

        cursor.close()
        connection.close()

        return jsonify({'restaurants': restaurant_names}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/fetch_nearby_restaurants', methods=['GET'])
def fetch_nearby_restaurants():
    lat = request.args.get('lat') or request.args.get('latitude')
    lon = request.args.get('lon') or request.args.get('longitude')

    if not lat or not lon:
        return jsonify({"error": "Latitude and Longitude are required!"}), 400

    radius = 3000  # 3 km
    url = f"https://api.geoapify.com/v2/places?categories=catering.restaurant&filter=circle:{lon},{lat},{radius}&limit=10&apiKey={GEO_API_KEY}"

    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        
        if "features" in data and len(data["features"]) > 0:
            nearby_restaurants = []
            conn = get_db_connection()

            if conn:
                with conn.cursor() as cursor:
                    for place in data["features"]:
                        name = place["properties"].get("name", "Unknown Restaurant")
                        lat = place["geometry"]["coordinates"][1]
                        lon = place["geometry"]["coordinates"][0]
                        
                        # Assuming the necessary fields are fetched from the API response
                        restaurant_id = place["properties"].get("id", None)  # Replace with correct key if available
                        city = place["properties"].get("city", "Unknown City")
                        address = place["properties"].get("address", "Unknown Address")
                        locality = place["properties"].get("locality", "Unknown Locality")
                        locality_verbose = place["properties"].get("locality_verbose", "Unknown Locality Verbose")
                        cuisines = place["properties"].get("cuisines", "Unknown Cuisines")
                        avg_cost_for_two = place["properties"].get("average_cost_for_two", None)
                        currency = place["properties"].get("currency", "Unknown Currency")
                        has_table_booking = place["properties"].get("has_table_booking", False)
                        has_online_delivery = place["properties"].get("has_online_delivery", False)
                        is_delivering_now = place["properties"].get("is_delivering_now", False)
                        switch_to_order_menu = place["properties"].get("switch_to_order_menu", False)
                        price_range = place["properties"].get("price_range", None)
                        aggregate_rating = place["properties"].get("aggregate_rating", None)
                        rating_color = place["properties"].get("rating_color", "Unknown Color")
                        rating_text = place["properties"].get("rating_text", "Unknown Rating")
                        votes = place["properties"].get("votes", 0)
                        country = place["properties"].get("country", "Unknown Country")

                        # Inserting the data into the database
                        cursor.execute("""
                            INSERT INTO restaurants 
                            (Restaurant_ID, Restaurant_Name, City, Address, Locality, Locality_Verbose, Longitude, Latitude, 
                                Cuisines, Average_Cost_for_two, Currency, Has_Table_booking, Has_Online_delivery, Is_delivering_now, 
                                Switch_to_order_menu, Price_range, Aggregate_rating, Rating_color, Rating_text, Votes, Country) 
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (restaurant_id, name, city, address, locality, locality_verbose, lon, lat, cuisines, 
                        avg_cost_for_two, currency, has_table_booking, has_online_delivery, is_delivering_now, 
                        switch_to_order_menu, price_range, aggregate_rating, rating_color, rating_text, votes, country))


                        nearby_restaurants.append({
                            "Restaurant_Name": name,
                            "Latitude": lat,
                            "Longitude": lon,
                            "Address": address,
                            "City": city,
                            "Locality": locality,
                            "Cuisines": cuisines,
                            "Aggregate_rating": aggregate_rating,
                            "Country": country,
                            "Currency": currency,
                            "Average_Cost_for_two": avg_cost_for_two,
                            "Has_Table_booking": "Yes" if has_table_booking else "No",
                            "Has_Online_delivery": "Yes" if has_online_delivery else "No",
                            "Is_delivering_now": "Yes" if is_delivering_now else "No"
                        })

                    # Commit changes to the database
                    conn.commit()
                    conn.close()

                    if nearby_restaurants:
                        return jsonify(nearby_restaurants)
                    else:
                        return jsonify([]) 

            else:
                return jsonify({"error": "Database connection failed!"}), 500
        else:
            return jsonify({"message": "No restaurants found within 3 km."}), 404
    else:
        return jsonify({"error": f"API Request Failed - {response.status_code}", "details": response.text}), response.status_code


@app.route('/restaurant/<int:restaurant_id>', methods=['GET'])
def get_restaurant(restaurant_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        with conn.cursor() as cursor:
            query = "SELECT * FROM restaurants WHERE Restaurant_ID = %s"
            cursor.execute(query, (restaurant_id,))
            restaurant = cursor.fetchone()  # Fetch the first matching record

        if restaurant:
            restaurant.pop("id", None)  # Remove the ID column
            return jsonify({"status": "success", "restaurant": restaurant}), 200
        else:
            return jsonify({"status": "error", "message": "Restaurant not found"}), 404

    except pymysql.MySQLError as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        conn.close()


@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400
        
        image = request.files['image']
        base64_image = base64.b64encode(image.read()).decode('utf-8')

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": "Identify the cuisine type shown in the image. Only return the name of the cuisine like Pizza,Burger,Rice Bowl,Fish,Noodles nothing else."},
                        {"inlineData": {"mimeType": "image/jpeg", "data": base64_image}}
                    ]
                }
            ]
        }

        response = requests.post(url, json=payload, headers=headers)
        result = response.json()

        if result.get("candidates"):
            detected_cuisine = result["candidates"][0]["content"]["parts"][0]["text"].strip().lower()
            return jsonify({"cuisine": detected_cuisine})
        else:
            return jsonify({"error": "Could not recognize the image"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8000)