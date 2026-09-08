import requests
import pandas as pd
import math

from geopy.distance import geodesic
from shapely.geometry import Point, shape


# ============================================================
# GET WEATHER FROM OPEN-METEO
# ============================================================

def get_weather(latitude, longitude):

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
        "&current=relative_humidity_2m,wind_speed_10m,wind_direction_10m"
        "&wind_speed_unit=kmh"
    )

    try:

        response = requests.get(
            url,
            timeout=30
        )

        print(
            "Weather status:",
            response.status_code
        )

    except requests.exceptions.Timeout:

        print(
            "⚠️ Open-Meteo weather request timed out."
        )

        print(
            "Continuing without weather data."
        )

        return None

    except requests.exceptions.RequestException as error:

        print(
            "⚠️ Open-Meteo weather request failed:",
            error
        )

        print(
            "Continuing without weather data."
        )

        return None


    if response.status_code != 200:

        print(
            "Open-Meteo weather request failed!"
        )

        print(
            "Response:",
            response.text
        )

        return None


    try:

        weather_data = response.json()

    except requests.exceptions.JSONDecodeError:

        print(
            "Open-Meteo returned invalid JSON!"
        )

        return None


    try:

        current_weather = weather_data["current"]

        return {

            "wind_speed":
                current_weather["wind_speed_10m"],

            "wind_direction":
                current_weather["wind_direction_10m"],

            "humidity":
                current_weather["relative_humidity_2m"]

        }

    except KeyError as error:

        print(
            "Weather data was missing:",
            error
        )

        return None


# ============================================================
# GET AIR QUALITY FROM OPEN-METEO
# ============================================================

def get_air_quality(latitude, longitude):

    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
        "&current=pm2_5,us_aqi"
    )

    try:

        response = requests.get(
            url,
            timeout=30
        )

    except requests.exceptions.Timeout:

        print(
            "⚠️ Open-Meteo air quality request timed out."
        )

        print(
            "Continuing without air quality data."
        )

        return None

    except requests.exceptions.RequestException as error:

        print(
            "⚠️ Open-Meteo air quality request failed:",
            error
        )

        print(
            "Continuing without air quality data."
        )

        return None


    if response.status_code != 200:

        print(
            "Open-Meteo air quality request failed!"
        )

        print(
            "Response:",
            response.text
        )

        return None


    try:

        air_data = response.json()

    except requests.exceptions.JSONDecodeError:

        print(
            "Open-Meteo returned invalid air quality JSON!"
        )

        return None


    try:

        current_air = air_data["current"]

        return {

            "pm2_5":
                current_air["pm2_5"],

            "aqi":
                current_air["us_aqi"]

        }

    except KeyError as error:

        print(
            "Air quality data was missing:",
            error
        )

        return None


# ============================================================
# CALCULATE BEARING
# ============================================================

def calculate_bearing(
    lat1,
    lon1,
    lat2,
    lon2
):

    lat1 = math.radians(lat1)

    lat2 = math.radians(lat2)

    difference_longitude = math.radians(
        lon2 - lon1
    )

    x = (
        math.sin(difference_longitude)
        *
        math.cos(lat2)
    )

    y = (
        math.cos(lat1)
        *
        math.sin(lat2)

        -

        math.sin(lat1)
        *
        math.cos(lat2)
        *
        math.cos(difference_longitude)
    )

    bearing = math.degrees(
        math.atan2(x, y)
    )

    return (
        bearing + 360
    ) % 360


# ============================================================
# CALCULATE WIND TOWARD HOME SCORE
# ============================================================

def calculate_wind_direction_score(
    fire_latitude,
    fire_longitude,
    home_latitude,
    home_longitude,
    weather
):

    if weather is None:

        return None


    wind_from = weather[
        "wind_direction"
    ]


    direction_to_home = calculate_bearing(

        fire_latitude,
        fire_longitude,

        home_latitude,
        home_longitude

    )


    # Weather stations report where the wind is
    # coming FROM.
    #
    # Add 180 degrees to determine where it is
    # actually moving TO.

    wind_toward = (
        wind_from + 180
    ) % 360


    angle_difference = abs(

        wind_toward
        -
        direction_to_home

    )


    if angle_difference > 180:

        angle_difference = (
            360
            -
            angle_difference
        )


    if angle_difference <= 30:

        wind_direction_score = 100

    elif angle_difference <= 60:

        wind_direction_score = 75

    elif angle_difference <= 90:

        wind_direction_score = 50

    elif angle_difference <= 120:

        wind_direction_score = 25

    else:

        wind_direction_score = 0


    return {

        "score":
            wind_direction_score,

        "direction_to_home":
            direction_to_home,

        "wind_from":
            wind_from,

        "wind_toward":
            wind_toward,

        "angle_difference":
            angle_difference

    }


# ============================================================
# CALCULATE DISTANCE SCORE
# ============================================================

def calculate_distance_score(
    distance_km
):

    if distance_km <= 8.05:

        return 100

    elif distance_km <= 16.1:

        return 90

    elif distance_km <= 40.23:

        return 75

    elif distance_km <= 80.47:

        return 50

    elif distance_km <= 160.93:

        return 25

    elif distance_km <= 200:

        return 10

    else:

        return 0


# ============================================================
# CALCULATE RECENCY SCORE
# ============================================================

def calculate_recency_score(
    age_hours
):

    if age_hours <= 1:

        return 100

    elif age_hours <= 3:

        return 90

    elif age_hours <= 6:

        return 75

    elif age_hours <= 12:

        return 50

    elif age_hours <= 18:

        return 25

    elif age_hours <= 24:

        return 10

    else:

        return 0


# ============================================================
# CALCULATE DETECTION / SATELLITE SCORE
# ============================================================

def calculate_detection_score(
    group
):

    detection_count = group[
        "detections"
    ]

    satellite_count = len(
        group["satellites"]
    )


    # Repeated detections contribute most
    # of this category.

    repeat_score = min(

        detection_count * 20,

        80

    )


    # Multiple satellites provide additional
    # confirmation.

    if satellite_count >= 3:

        satellite_score = 100

    elif satellite_count == 2:

        satellite_score = 75

    else:

        satellite_score = 25


    detection_score = (

        repeat_score * 0.60

        +

        satellite_score * 0.40

    )


    return detection_score


# ============================================================
# CALCULATE FRP SCORE
# ============================================================

def calculate_frp_score(
    group
):

    return min(

        (
            group["max_frp"]
            /
            5
        )
        *
        100,

        100

    )


# ============================================================
# CALCULATE CONFIDENCE SCORE
# ============================================================

def calculate_confidence_score(
    group
):

    confidence_scores = {

        "l": 25,

        "n": 60,

        "h": 100

    }

    return confidence_scores.get(

        group["confidence"],

        0

    )


# ============================================================
# CALCULATE PM2.5 SCORE
# ============================================================

def calculate_pm25_score(
    air_quality
):

    if air_quality is None:

        return None


    pm25 = air_quality[
        "pm2_5"
    ]


    return min(

        (
            pm25
            /
            35
        )
        *
        100,

        100

    )


# ============================================================
# CALCULATE WIND SPEED SCORE
# ============================================================

def calculate_wind_speed_score(
    weather
):

    if weather is None:

        return None


    wind_speed = weather[
        "wind_speed"
    ]


    if wind_speed <= 5:

        return 20

    elif wind_speed <= 10:

        return 40

    elif wind_speed <= 20:

        return 70

    elif wind_speed <= 30:

        return 90

    else:

        return 100


# ============================================================
# CALCULATE HUMIDITY SCORE
# ============================================================

def calculate_humidity_score(
    weather
):

    if weather is None:

        return None


    humidity = weather[
        "humidity"
    ]


    if humidity >= 80:

        return 10

    elif humidity >= 60:

        return 30

    elif humidity >= 40:

        return 60

    elif humidity >= 20:

        return 80

    else:

        return 100


# ============================================================
# CALCULATE COMPLETE CONCERN SCORE
# ============================================================

def calculate_concern_score(

    group,

    distance_km,

    weather,

    air_quality,

    now,

    home_latitude,

    home_longitude

):

    distance_score = calculate_distance_score(
        distance_km
    )


    age_hours = (

        now
        -
        group["latest_time"]

    ).total_seconds() / 3600


    recency_score = calculate_recency_score(
        age_hours
    )


    detection_score = calculate_detection_score(
        group
    )


    frp_score = calculate_frp_score(
        group
    )


    confidence_score = calculate_confidence_score(
        group
    )


    pm25_score = calculate_pm25_score(
        air_quality
    )


    wind_information = calculate_wind_direction_score(

        group["latitude"],

        group["longitude"],

        home_latitude,

        home_longitude,

        weather

    )


    if wind_information is not None:

        wind_direction_score = (
            wind_information["score"]
        )

    else:

        wind_direction_score = None


    wind_speed_score = calculate_wind_speed_score(
        weather
    )


    humidity_score = calculate_humidity_score(
        weather
    )


    # ========================================================
    # SCORE WEIGHTS
    # ========================================================

    weights = {

        "distance": 0.25,

        "recency": 0.25,

        "detections": 0.15,

        "frp": 0.10,

        "confidence": 0.05,

        "wind_direction": 0.05,

        "wind_speed": 0.05,

        "humidity": 0.05,

        "pm25": 0.05

    }


    scores = {

        "distance":
            distance_score,

        "recency":
            recency_score,

        "detections":
            detection_score,

        "frp":
            frp_score,

        "confidence":
            confidence_score,

        "wind_direction":
            wind_direction_score,

        "wind_speed":
            wind_speed_score,

        "humidity":
            humidity_score,

        "pm25":
            pm25_score

    }


    # Ignore unavailable weather/AQ components
    # instead of treating missing data as zero.

    available_scores = {

        name: score

        for name, score in scores.items()

        if score is not None

    }


    total_weight = sum(

        weights[name]

        for name in available_scores

    )


    concern_score = sum(

        available_scores[name]
        *
        weights[name]

        for name in available_scores

    ) / total_weight


    return {

        "score":
            concern_score,

        "distance":
            distance_score,

        "recency":
            recency_score,

        "detections":
            detection_score,

        "frp":
            frp_score,

        "confidence":
            confidence_score,

        "wind_direction":
            wind_direction_score,

        "wind_speed":
            wind_speed_score,

        "humidity":
            humidity_score,

        "pm25":
            pm25_score,

        "age_hours":
            age_hours,

        "wind_information":
            wind_information

    }


# ============================================================
# WFIGS SETTINGS
# ============================================================

WFIGS_INCIDENT_URL = (

    "https://services3.arcgis.com/"

    "T4QMspbfLg3qTGWY/"

    "arcgis/rest/services/"

    "WFIGS_Incident_Locations_Current/"

    "FeatureServer/0/query"

)


WFIGS_PERIMETER_URL = (

    "https://services3.arcgis.com/"

    "T4QMspbfLg3qTGWY/"

    "arcgis/rest/services/"

    "WFIGS_Interagency_Perimeters_Current/"

    "FeatureServer/0/query"

)


WFIGS_MATCH_DISTANCE_KM = 2


# ============================================================
# GET CURRENT WFIGS INCIDENTS
# ============================================================

def get_wfigs_incidents():

    params = {

        "where":
            "1=1",

        "outFields": (

            "OBJECTID,"

            "IncidentName,"

            "IncidentTypeCategory,"

            "IncidentTypeKind,"

            "IncidentSize,"

            "FinalAcres,"

            "PercentContained,"

            "InitialLatitude,"

            "InitialLongitude,"

            "IrwinID,"

            "UniqueFireIdentifier,"

            "POOState,"

            "POOCity,"

            "POOCounty"

        ),

        "returnGeometry":
            "true",

        "f":
            "geojson"

    }


    try:

        response = requests.get(

            WFIGS_INCIDENT_URL,

            params=params,

            timeout=60

        )

    except requests.exceptions.Timeout:

        print(
            "⚠️ WFIGS incident request timed out."
        )

        return None

    except requests.RequestException as error:

        print(

            "WFIGS incident request failed:",

            error

        )

        return None


    print(

        "WFIGS incident status:",

        response.status_code

    )


    if response.status_code != 200:

        print(
            "WFIGS incident request failed!"
        )

        print(
            response.text
        )

        return None


    try:

        data = response.json()

    except requests.exceptions.JSONDecodeError:

        print(
            "WFIGS returned invalid incident JSON!"
        )

        return None


    return data


# ============================================================
# GET CURRENT WFIGS PERIMETERS
# ============================================================

def get_wfigs_perimeters():

    params = {

        "where":
            "1=1",

        "outFields": (

            "OBJECTID,"

            "poly_IncidentName,"

            "poly_GISAcres,"

            "poly_Acres_AutoCalc,"

            "poly_IRWINID,"

            "poly_FORID,"

            "poly_Source,"

            "attr_CalculatedAcres,"

            "attr_IncidentSize,"

            "attr_IncidentTypeCategory,"

            "attr_IncidentTypeKind,"

            "attr_IncidentName,"

            "attr_IrwinID"

        ),

        "returnGeometry":
            "true",

        "f":
            "geojson"

    }


    try:

        response = requests.get(

            WFIGS_PERIMETER_URL,

            params=params,

            timeout=90

        )

    except requests.exceptions.Timeout:

        print(
            "⚠️ WFIGS perimeter request timed out."
        )

        return None

    except requests.RequestException as error:

        print(

            "WFIGS perimeter request failed:",

            error

        )

        return None


    print(

        "WFIGS perimeter status:",

        response.status_code

    )


    if response.status_code != 200:

        print(
            "WFIGS perimeter request failed!"
        )

        print(
            response.text
        )

        return None


    try:

        data = response.json()

    except requests.exceptions.JSONDecodeError:

        print(
            "WFIGS returned invalid perimeter JSON!"
        )

        return None


    return data


# ============================================================
# FIND WFIGS INCIDENT BY IRWIN ID
# ============================================================

def find_wfigs_incident_by_irwin_id(

    wfigs_incidents,

    irwin_id

):

    if not irwin_id:

        return None


    if wfigs_incidents is None:

        return None


    for feature in wfigs_incidents.get(

        "features",

        []

    ):

        properties = feature.get(

            "properties",

            {}

        )


        incident_irwin_id = properties.get(

            "IrwinID"

        )


        if (

            incident_irwin_id

            and

            incident_irwin_id == irwin_id

        ):

            return properties


    return None


# ============================================================
# WFIGS TYPE NAME
# ============================================================

def wfigs_type_name(
    type_code
):

    type_names = {

        "WF":
            "Wildfire",

        "RX":
            "Prescribed Fire",

        "CX":
            "Incident Complex"

    }


    return type_names.get(

        type_code,

        type_code or "Unknown"

    )


# ============================================================
# MATCH FIRMS GROUP TO WFIGS
# ============================================================

def match_group_to_wfigs(

    group,

    firms_detections,

    wfigs_perimeters,

    wfigs_incidents

):

    if (

        wfigs_perimeters is None

        and

        wfigs_incidents is None

    ):

        return None


    # ========================================================
    # CREATE FIRMS POINTS
    # ========================================================

    group_points = []


    for detection in firms_detections:

        point = Point(

            float(
                detection["longitude"]
            ),

            float(
                detection["latitude"]
            )

        )


        group_points.append(
            point
        )


    # ========================================================
    # CHECK WFIGS PERIMETERS
    # ========================================================

    if wfigs_perimeters is not None:

        best_match = None

        best_match_score = -1


        for feature in wfigs_perimeters.get(

            "features",

            []

        ):

            geometry_data = feature.get(
                "geometry"
            )


            if not geometry_data:

                continue


            try:

                perimeter = shape(
                    geometry_data
                )

            except Exception:

                continue


            properties = feature.get(

                "properties",

                {}

            )


            points_inside = 0

            closest_distance_km = float(
                "inf"
            )


            for point in group_points:

                # ------------------------------------------------
                # FIRMS POINT INSIDE PERIMETER
                # ------------------------------------------------

                if perimeter.contains(point):

                    points_inside += 1

                    closest_distance_km = 0


                else:

                    nearest_point = (

                        perimeter.boundary.interpolate(

                            perimeter.boundary.project(
                                point
                            )

                        )

                    )


                    nearest_latitude = (
                        nearest_point.y
                    )

                    nearest_longitude = (
                        nearest_point.x
                    )


                    distance = geodesic(

                        (
                            point.y,
                            point.x
                        ),

                        (
                            nearest_latitude,
                            nearest_longitude
                        )

                    ).kilometers


                    if distance < closest_distance_km:

                        closest_distance_km = (
                            distance
                        )


            # ------------------------------------------------
            # DETERMINE WHETHER THIS IS A MATCH
            # ------------------------------------------------

            if (

                points_inside > 0

                or

                closest_distance_km
                <=
                WFIGS_MATCH_DISTANCE_KM

            ):

                if points_inside > 0:

                    match_score = (

                        100

                        +

                        points_inside * 10

                    )

                else:

                    match_score = (

                        50

                        -

                        closest_distance_km

                    )


                if match_score > best_match_score:

                    best_match_score = (
                        match_score
                    )


                    best_match = {

                        "properties":
                            properties,

                        "points_inside":
                            points_inside,

                        "distance_to_perimeter_km":
                            closest_distance_km,

                        "match_score":
                            match_score

                    }


        # ========================================================
        # PERIMETER MATCH FOUND
        # ========================================================

        if best_match is not None:

            properties = best_match[
                "properties"
            ]


            # ----------------------------------------------------
            # Get IRWIN ID from perimeter.
            # ----------------------------------------------------

            perimeter_irwin_id = (

                properties.get(
                    "poly_IRWINID"
                )

                or

                properties.get(
                    "attr_IrwinID"
                )

            )


            # ----------------------------------------------------
            # Find corresponding WFIGS incident.
            #
            # This is important because PercentContained
            # is stored in the incident layer rather than
            # the perimeter layer.
            # ----------------------------------------------------

            incident = (

                find_wfigs_incident_by_irwin_id(

                    wfigs_incidents,

                    perimeter_irwin_id

                )

            )


            # ====================================================
            # PERIMETER INFORMATION
            # ====================================================

            incident_name = (

                properties.get(
                    "poly_IncidentName"
                )

                or

                properties.get(
                    "attr_IncidentName"
                )

            )


            incident_type_code = (

                properties.get(
                    "attr_IncidentTypeCategory"
                )

            )


            gis_acres = (

                properties.get(
                    "poly_GISAcres"
                )

            )


            calculated_acres = (

                properties.get(
                    "attr_CalculatedAcres"
                )

            )


            incident_size = (

                properties.get(
                    "attr_IncidentSize"
                )

            )


            # ====================================================
            # MERGE INCIDENT INFORMATION
            # ====================================================

            percent_contained = None

            final_acres = None

            unique_fire_identifier = None

            state = None

            city = None

            county = None


            if incident is not None:

                incident_name = (

                    incident.get(
                        "IncidentName"
                    )

                    or

                    incident_name

                )


                incident_type_code = (

                    incident.get(
                        "IncidentTypeCategory"
                    )

                    or

                    incident_type_code

                )


                percent_contained = (

                    incident.get(
                        "PercentContained"
                    )

                )


                final_acres = (

                    incident.get(
                        "FinalAcres"
                    )

                )


                unique_fire_identifier = (

                    incident.get(
                        "UniqueFireIdentifier"
                    )

                )


                state = (

                    incident.get(
                        "POOState"
                    )

                )


                city = (

                    incident.get(
                        "POOCity"
                    )

                )


                county = (

                    incident.get(
                        "POOCounty"
                    )

                )


                # If perimeter acreage is unavailable,
                # use incident acreage.

                if (

                    gis_acres is None

                    and

                    calculated_acres is None

                    and

                    incident_size is None

                ):

                    incident_size = (

                        incident.get(
                            "IncidentSize"
                        )

                    )


            # ====================================================
            # RETURN COMPLETE WFIGS INFORMATION
            # ====================================================

            return {

                "source":
                    "WFIGS perimeter + incident",

                "match_type": (

                    "Inside official perimeter"

                    if best_match[
                        "points_inside"
                    ] > 0

                    else

                    "Near official perimeter"

                ),

                "match_score":
                    best_match[
                        "match_score"
                    ],

                "points_inside":
                    best_match[
                        "points_inside"
                    ],

                "distance_to_perimeter_km":
                    best_match[
                        "distance_to_perimeter_km"
                    ],

                "incident_name":
                    incident_name,

                "incident_type":
                    wfigs_type_name(
                        incident_type_code
                    ),

                "incident_type_code":
                    incident_type_code,

                "gis_acres":
                    gis_acres,

                "calculated_acres":
                    calculated_acres,

                "incident_size":
                    incident_size,

                "final_acres":
                    final_acres,

                "percent_contained":
                    percent_contained,

                "irwin_id":
                    perimeter_irwin_id,

                "unique_fire_identifier":
                    unique_fire_identifier,

                "state":
                    state,

                "city":
                    city,

                "county":
                    county

            }


    # ========================================================
    # FALLBACK: WFIGS INCIDENT LOCATION
    # ========================================================

    if wfigs_incidents is not None:

        best_incident = None

        best_distance = float(
            "inf"
        )


        for feature in wfigs_incidents.get(

            "features",

            []

        ):

            properties = feature.get(

                "properties",

                {}

            )


            geometry = feature.get(
                "geometry"
            )


            if not geometry:

                continue


            coordinates = geometry.get(
                "coordinates"
            )


            if not coordinates:

                continue


            incident_longitude = (
                coordinates[0]
            )

            incident_latitude = (
                coordinates[1]
            )


            for point in group_points:

                distance_km = geodesic(

                    (
                        point.y,
                        point.x
                    ),

                    (
                        incident_latitude,
                        incident_longitude
                    )

                ).kilometers


                if distance_km < best_distance:

                    best_distance = (
                        distance_km
                    )

                    best_incident = (
                        properties
                    )


        # ----------------------------------------------------
        # Only use reasonably close incident.
        # ----------------------------------------------------

        if (

            best_incident is not None

            and

            best_distance
            <=
            WFIGS_MATCH_DISTANCE_KM

        ):

            return {

                "source":
                    "WFIGS incident location",

                "match_type":
                    "Near official incident location",

                "match_score":
                    25,

                "points_inside":
                    0,

                "distance_to_perimeter_km":
                    None,

                "distance_to_incident_km":
                    best_distance,

                "incident_name":
                    best_incident.get(
                        "IncidentName"
                    ),

                "incident_type":
                    wfigs_type_name(

                        best_incident.get(
                            "IncidentTypeCategory"
                        )

                    ),

                "incident_type_code":
                    best_incident.get(
                        "IncidentTypeCategory"
                    ),

                "gis_acres":
                    None,

                "calculated_acres":
                    None,

                "incident_size":
                    best_incident.get(
                        "IncidentSize"
                    ),

                "final_acres":
                    best_incident.get(
                        "FinalAcres"
                    ),

                "percent_contained":
                    best_incident.get(
                        "PercentContained"
                    ),

                "irwin_id":
                    best_incident.get(
                        "IrwinID"
                    ),

                "unique_fire_identifier":
                    best_incident.get(
                        "UniqueFireIdentifier"
                    ),

                "state":
                    best_incident.get(
                        "POOState"
                    ),

                "city":
                    best_incident.get(
                        "POOCity"
                    ),

                "county":
                    best_incident.get(
                        "POOCounty"
                    )

            }


    # ========================================================
    # NO WFIGS MATCH
    # ========================================================

    return None


# ============================================================
# NASA FIRMS SETTINGS
# ============================================================

# IMPORTANT:
#
# Put your NEW NASA FIRMS MAP_KEY here.
#
# Do not use the previously exposed key.
#

MAP_KEY = "bdc6c25cd44935e88e28d0b05002a663"


# ============================================================
# NASA SATELLITES
# ============================================================

FIRMS_SOURCES = [

    "VIIRS_NOAA20_NRT",

    "VIIRS_NOAA21_NRT"

]


# ============================================================
# SAVED LOCATION
# ============================================================

HOME_LAT = 43.7001

HOME_LON = -79.4163

home_location = (

    HOME_LAT,

    HOME_LON

)


# ============================================================
# SEARCH SETTINGS
# ============================================================

SEARCH_RADIUS_KM = 200

ALERT_RADIUS_KM = 50

GROUP_RADIUS_KM = 5

GROUP_TIME_HOURS = 6


# ============================================================
# CREATE NASA SEARCH BOX
# ============================================================

lat_change = (
    SEARCH_RADIUS_KM
    /
    111
)


lon_change = (

    SEARCH_RADIUS_KM

    /

    (
        111
        *
        abs(
            math.cos(
                math.radians(
                    HOME_LAT
                )
            )
        )
    )

)


south = HOME_LAT - lat_change

north = HOME_LAT + lat_change

west = HOME_LON - lon_change

east = HOME_LON + lon_change


bbox = (

    f"{west},"
    f"{south},"
    f"{east},"
    f"{north}"

)


print(

    "NASA search box:",

    bbox

)


# ============================================================
# GET DATA FROM ALL NASA SATELLITES
# ============================================================

all_detections = []


for source in FIRMS_SOURCES:

    print()

    print(

        "Getting NASA FIRMS data from:",

        source

    )


    url = (

        "https://firms.modaps.eosdis.nasa.gov/"

        "api/area/csv/"

        f"{MAP_KEY}/"

        f"{source}/"

        f"{bbox}/"

        "2"

    )


    try:

        response = requests.get(

            url,

            timeout=30

        )

    except requests.exceptions.Timeout:

        print(

            "⚠️ NASA FIRMS request timed out for",

            source

        )

        continue

    except requests.RequestException as error:

        print(

            "NASA request failed for",

            source,

            ":",

            error

        )

        continue


    print(

        "NASA status code:",

        response.status_code

    )


    if response.status_code != 200:

        print(

            "NASA request failed for",

            source

        )

        print(
            response.text
        )

        continue


    try:

        source_data = pd.read_csv(

            pd.io.common.StringIO(
                response.text
            )

        )

    except Exception as error:

        print(

            "Could not read NASA data for",

            source,

            ":",

            error

        )

        continue


    all_detections.append(
        source_data
    )


    print(

        "Detections received:",

        len(source_data)

    )


# ============================================================
# COMBINE ALL SATELLITE DATA
# ============================================================

if len(all_detections) == 0:

    print(
        "\nNo NASA FIRMS data was received."
    )

    exit()


data = pd.concat(

    all_detections,

    ignore_index=True

)


# ============================================================
# SAVE COMBINED NASA DATA
# ============================================================

data.to_csv(

    "fire_data.csv",

    index=False

)


print()

print(
    "NASA data successfully downloaded!"
)


print(

    "Total detections from all satellites:",

    len(data)

)


# ============================================================
# CONVERT NASA DATE/TIME
# ============================================================

data["timestamp"] = pd.to_datetime(

    data["acq_date"].astype(str)

    +

    " "

    +

    data["acq_time"]
    .astype(str)
    .str.zfill(4),

    format="%Y-%m-%d %H%M",

    utc=True

)


# ============================================================
# KEEP ONLY LAST 24 HOURS
# ============================================================

now = pd.Timestamp.now(
    tz="UTC"
)


data = data[

    data["timestamp"]

    >=

    now - pd.Timedelta(
        hours=24
    )

]


# ============================================================
# SORT BY TIME
# ============================================================

data = data.sort_values(

    "timestamp"

)


# ============================================================
# GROUP DETECTIONS
# ============================================================

activity_groups = []


# ============================================================
# CONFIDENCE RANKING
# ============================================================

confidence_order = {

    "l": 1,

    "n": 2,

    "h": 3

}


# ============================================================
# PROCESS EVERY NASA DETECTION
# ============================================================

for index, fire in data.iterrows():

    fire_location = (

        fire["latitude"],

        fire["longitude"]

    )


    fire_time = fire[
        "timestamp"
    ]


    added_to_group = False


    # ========================================================
    # CHECK EXISTING GROUPS
    # ========================================================

    for group in activity_groups:

        group_location = (

            group["latitude"],

            group["longitude"]

        )


        distance_km = geodesic(

            fire_location,

            group_location

        ).kilometers


        time_difference = (

            fire_time

            -

            group["latest_time"]

        ).total_seconds() / 3600


        if (

            distance_km
            <=
            GROUP_RADIUS_KM

            and

            time_difference
            <=
            GROUP_TIME_HOURS

        ):

            group["detections"] += 1


            # ------------------------------------------------
            # UPDATE CENTROID
            # ------------------------------------------------

            group["latitude"] = (

                group["latitude"]

                +

                fire["latitude"]

            ) / 2


            group["longitude"] = (

                group["longitude"]

                +

                fire["longitude"]

            ) / 2


            # ------------------------------------------------
            # UPDATE LATEST TIME
            # ------------------------------------------------

            group["latest_time"] = fire_time


            # ------------------------------------------------
            # UPDATE MAX FRP
            # ------------------------------------------------

            if (

                fire["frp"]

                >

                group["max_frp"]

            ):

                group["max_frp"] = (
                    fire["frp"]
                )


            # ------------------------------------------------
            # UPDATE CONFIDENCE
            # ------------------------------------------------

            current_confidence = (
                group["confidence"]
            )

            new_confidence = (
                fire["confidence"]
            )


            if (

                confidence_order.get(

                    new_confidence,

                    0

                )

                >

                confidence_order.get(

                    current_confidence,

                    0

                )

            ):

                group["confidence"] = (
                    new_confidence
                )


            # ------------------------------------------------
            # ADD SATELLITE
            # ------------------------------------------------

            if (

                fire["satellite"]

                not in

                group["satellites"]

            ):

                group["satellites"].append(

                    fire["satellite"]

                )


            # ------------------------------------------------
            # SAVE INDIVIDUAL FIRMS DETECTION
            # ------------------------------------------------

            group[
                "firms_detections"
            ].append({

                "latitude":
                    fire["latitude"],

                "longitude":
                    fire["longitude"],

                "timestamp":
                    fire_time,

                "satellite":
                    fire["satellite"],

                "confidence":
                    fire["confidence"],

                "frp":
                    fire["frp"]

            })


            added_to_group = True

            break


    # ========================================================
    # CREATE NEW GROUP
    # ========================================================

    if not added_to_group:

        new_group = {

            "latitude":
                fire["latitude"],

            "longitude":
                fire["longitude"],

            "detections":
                1,

            "first_time":
                fire_time,

            "latest_time":
                fire_time,

            "max_frp":
                fire["frp"],

            "confidence":
                fire["confidence"],

            "satellites": [

                fire["satellite"]

            ],

            "firms_detections": [

                {

                    "latitude":
                        fire["latitude"],

                    "longitude":
                        fire["longitude"],

                    "timestamp":
                        fire_time,

                    "satellite":
                        fire["satellite"],

                    "confidence":
                        fire["confidence"],

                    "frp":
                        fire["frp"]

                }

            ]

        }


        activity_groups.append(
            new_group
        )


# ============================================================
# GET WFIGS DATA
# ============================================================

print(
    "\n🔥 GETTING WFIGS DATA"
)


wfigs_incidents = get_wfigs_incidents()

wfigs_perimeters = get_wfigs_perimeters()


if wfigs_incidents is not None:

    print(

        "WFIGS incidents downloaded:",

        len(

            wfigs_incidents.get(

                "features",

                []

            )

        )

    )

else:

    print(
        "WFIGS incidents unavailable."
    )


if wfigs_perimeters is not None:

    print(

        "WFIGS perimeters downloaded:",

        len(

            wfigs_perimeters.get(

                "features",

                []

            )

        )

    )

else:

    print(
        "WFIGS perimeters unavailable."
    )


# ============================================================
# PRINT ACTIVITY GROUPS
# ============================================================

print(
    "\n🔥 FIRE ACTIVITY GROUPS"
)


for number, group in enumerate(

    activity_groups,

    start=1

):

    # ========================================================
    # DISTANCE FROM HOME
    # ========================================================

    distance_from_home = geodesic(

        home_location,

        (

            group["latitude"],

            group["longitude"]

        )

    ).kilometers


    # ========================================================
    # GET WEATHER
    # ========================================================

    weather = get_weather(

        group["latitude"],

        group["longitude"]

    )


    # ========================================================
    # GET AIR QUALITY
    # ========================================================

    air_quality = get_air_quality(

        group["latitude"],

        group["longitude"]

    )


    # ========================================================
    # CALCULATE CONCERN SCORE
    # ========================================================

    concern = calculate_concern_score(

        group,

        distance_from_home,

        weather,

        air_quality,

        now,

        HOME_LAT,

        HOME_LON

    )


    final_score = concern[
        "score"
    ]


    # ========================================================
    # DETERMINE CATEGORY
    # ========================================================

    if final_score < 25:

        category = "Low"

    elif final_score < 50:

        category = "Moderate"

    elif final_score < 75:

        category = "Elevated"

    else:

        category = "High"


    # ========================================================
    # READABLE CONFIDENCE
    # ========================================================

    confidence_names = {

        "l":
            "Low",

        "n":
            "Nominal",

        "h":
            "High"

    }


    readable_confidence = (

        confidence_names.get(

            group["confidence"],

            group["confidence"]

        )

    )


    # ========================================================
    # MATCH WFIGS
    # ========================================================

    wfigs_match = match_group_to_wfigs(

        group,

        group["firms_detections"],

        wfigs_perimeters,

        wfigs_incidents

    )


    # Save WFIGS information inside group.

    group["wfigs"] = wfigs_match


    # ========================================================
    # PRINT GROUP
    # ========================================================

    print()

    print(
        "=================================================="
    )

    print(
        "🔥 ACTIVITY GROUP",
        number
    )

    print(
        "=================================================="
    )

    print()

    print(

        "Detections:",

        group["detections"]

    )


    print(

        "Location:",

        group["latitude"],

        group["longitude"]

    )


    print(

        f"Distance from home: "

        f"{distance_from_home:.2f} km"

    )


    print(

        "Confidence:",

        readable_confidence

    )


    print(

        f"Maximum FRP: "

        f"{group['max_frp']} MW"

    )


    print(

        "Satellites:",

        ", ".join(

            group["satellites"]

        )

    )


    print(

        "Number of satellites:",

        len(

            group["satellites"]

        )

    )


    if len(
        group["satellites"]
    ) >= 2:

        print(

            "🛰️ Multiple satellites detected heat in this area!"

        )

    else:

        print(

            "🛰️ Satellite confirmation: 1 satellite"

        )


    print(

        "First detection:",

        group["first_time"]

    )


    print(

        "Latest detection:",

        group["latest_time"]

    )


    # ========================================================
    # WFIGS OFFICIAL DATA
    # ========================================================

    print()

    print(
        "🏛️ WFIGS OFFICIAL DATA"
    )


    if wfigs_match is not None:

        print(
            "Match found: YES"
        )


        print(

            "Match source:",

            wfigs_match["source"]

        )


        print(

            "Match type:",

            wfigs_match["match_type"]

        )


        print(

            "Official incident:",

            wfigs_match["incident_name"]

        )


        print(

            "Incident type:",

            wfigs_match["incident_type"]

        )


        # ----------------------------------------------------
        # PERIMETER DISTANCE
        # ----------------------------------------------------

        if wfigs_match.get(

            "distance_to_perimeter_km"

        ) is not None:

            print(

                "Distance to perimeter:",

                round(

                    wfigs_match[

                        "distance_to_perimeter_km"

                    ],

                    2

                ),

                "km"

            )


        # ----------------------------------------------------
        # FIRMS POINTS INSIDE
        # ----------------------------------------------------

        if wfigs_match.get(

            "points_inside"

        ) is not None:

            print(

                "FIRMS points inside perimeter:",

                wfigs_match[

                    "points_inside"

                ]

            )


        # ----------------------------------------------------
        # INCIDENT DISTANCE
        # ----------------------------------------------------

        if wfigs_match.get(

            "distance_to_incident_km"

        ) is not None:

            print(

                "Distance to official incident:",

                round(

                    wfigs_match[

                        "distance_to_incident_km"

                    ],

                    2

                ),

                "km"

            )


        # ----------------------------------------------------
        # ACREAGE
        # ----------------------------------------------------

        acres = (

            wfigs_match.get(
                "gis_acres"
            )

            or

            wfigs_match.get(
                "calculated_acres"
            )

            or

            wfigs_match.get(
                "incident_size"
            )

            or

            wfigs_match.get(
                "final_acres"
            )

        )


        if acres is not None:

            print(

                "Official acreage:",

                acres,

                "acres"

            )

        else:

            print(
                "Official acreage: Unavailable"
            )


        # ----------------------------------------------------
        # CONTAINMENT
        # ----------------------------------------------------

        if wfigs_match.get(

            "percent_contained"

        ) is not None:

            print(

                "Containment:",

                wfigs_match[

                    "percent_contained"

                ],

                "%"

            )

        else:

            print(
                "Containment: Unavailable"
            )


        # ----------------------------------------------------
        # IRWIN ID
        # ----------------------------------------------------

        if wfigs_match.get(
            "irwin_id"
        ):

            print(

                "IRWIN ID:",

                wfigs_match[
                    "irwin_id"
                ]

            )


        # ----------------------------------------------------
        # UNIQUE FIRE IDENTIFIER
        # ----------------------------------------------------

        if wfigs_match.get(

            "unique_fire_identifier"

        ):

            print(

                "Unique Fire Identifier:",

                wfigs_match[

                    "unique_fire_identifier"

                ]

            )


        # ----------------------------------------------------
        # STATE
        # ----------------------------------------------------

        if wfigs_match.get(
            "state"
        ):

            print(

                "State:",

                wfigs_match[
                    "state"
                ]

            )


        # ----------------------------------------------------
        # CITY
        # ----------------------------------------------------

        if wfigs_match.get(
            "city"
        ):

            print(

                "City:",

                wfigs_match[
                    "city"
                ]

            )


        # ----------------------------------------------------
        # COUNTY
        # ----------------------------------------------------

        if wfigs_match.get(
            "county"
        ):

            print(

                "County:",

                wfigs_match[
                    "county"
                ]

            )


    else:

        print(
            "Match found: NO"
        )

        print(

            "No nearby WFIGS incident/perimeter matched."

        )

        print(

            "Continuing with FIRMS data."

        )


    # ========================================================
    # WEATHER
    # ========================================================

    print()

    print(
        "🌬️ WEATHER"
    )


    if weather is not None:

        print(

            "Wind speed:",

            weather["wind_speed"],

            "km/h"

        )


        print(

            "Wind direction:",

            weather["wind_direction"],

            "°"

        )


        print(

            "Humidity:",

            weather["humidity"],

            "%"

        )

    else:

        print(
            "Weather data unavailable"
        )


    # ========================================================
    # AIR QUALITY
    # ========================================================

    print()

    print(
        "🌫️ AIR QUALITY"
    )


    if air_quality is not None:

        print(

            "US AQI:",

            air_quality["aqi"]

        )


        print(

            "PM2.5:",

            air_quality["pm2_5"],

            "µg/m³"

        )

    else:

        print(
            "Air quality data unavailable"
        )


    # ========================================================
    # SCORE BREAKDOWN
    # ========================================================

    print()

    print(
        "📊 CONCERN SCORE BREAKDOWN"
    )

    print()


    print(

        "Distance score:",

        round(

            concern["distance"],

            1

        ),

        "(25%)"

    )


    print(

        "Recency score:",

        round(

            concern["recency"],

            1

        ),

        "(25%)"

    )


    print(

        "Detection/satellite score:",

        round(

            concern["detections"],

            1

        ),

        "(15%)"

    )


    print(

        "FRP score:",

        round(

            concern["frp"],

            1

        ),

        "(10%)"

    )


    print(

        "Confidence score:",

        round(

            concern["confidence"],

            1

        ),

        "(5%)"

    )


    if concern[
        "wind_direction"
    ] is not None:

        print(

            "Wind direction score:",

            round(

                concern["wind_direction"],

                1

            ),

            "(5%)"

        )

    else:

        print(
            "Wind direction score: Unavailable"
        )


    if concern[
        "wind_speed"
    ] is not None:

        print(

            "Wind speed score:",

            round(

                concern["wind_speed"],

                1

            ),

            "(5%)"

        )

    else:

        print(
            "Wind speed score: Unavailable"
        )


    if concern[
        "humidity"
    ] is not None:

        print(

            "Humidity score:",

            round(

                concern["humidity"],

                1

            ),

            "(5%)"

        )

    else:

        print(
            "Humidity score: Unavailable"
        )


    if concern[
        "pm25"
    ] is not None:

        print(

            "PM2.5 score:",

            round(

                concern["pm25"],

                1

            ),

            "(5%)"

        )

    else:

        print(
            "PM2.5 score: Unavailable"
        )


    # ========================================================
    # WIND ANALYSIS
    # ========================================================

    if concern[
        "wind_information"
    ] is not None:

        wind_info = concern[
            "wind_information"
        ]


        print()

        print(
            "🌬️ WIND ANALYSIS"
        )


        print(

            "Direction from detection to home:",

            round(

                wind_info[
                    "direction_to_home"
                ],

                1

            ),

            "°"

        )


        print(

            "Wind coming from:",

            round(

                wind_info[
                    "wind_from"
                ],

                1

            ),

            "°"

        )


        print(

            "Wind moving toward:",

            round(

                wind_info[
                    "wind_toward"
                ],

                1

            ),

            "°"

        )


        print(

            "Angle difference:",

            round(

                wind_info[
                    "angle_difference"
                ],

                1

            ),

            "°"

        )


        if (

            wind_info[
                "angle_difference"
            ]

            <=

            30

        ):

            print(

                "⚠️ Wind is moving strongly toward home!"

            )

        elif (

            wind_info[
                "angle_difference"
            ]

            <=

            60

        ):

            print(

                "⚠️ Wind is somewhat toward home."

            )

        elif (

            wind_info[
                "angle_difference"
            ]

            <=

            90

        ):

            print(

                "Wind direction is partially toward home."

            )

        else:

            print(

                "Wind is not primarily moving toward home."

            )


    # ========================================================
    # FINAL SCORE
    # ========================================================

    print()

    print(
        "🔥 FINAL CONCERN SCORE"
    )


    print(

        "Concern Score:",

        round(

            final_score,

            1

        ),

        "/ 100"

    )


    print(

        "Concern Level:",

        category

    )


    print(

        "Detection age:",

        round(

            concern["age_hours"],

            2

        ),

        "hours"

    )


# ============================================================
# PRINT INDIVIDUAL DETECTIONS
# ============================================================

print(
    "\n📍 INDIVIDUAL DETECTIONS"
)


for index, fire in data.iterrows():

    fire_location = (

        fire["latitude"],

        fire["longitude"]

    )


    distance_km = geodesic(

        home_location,

        fire_location

    ).kilometers


    print(

        f"Detection {index + 1}: "

        f"{distance_km:.2f} km away "

        f"({fire['satellite']})"

    )


    if distance_km <= ALERT_RADIUS_KM:

        print(

            "🔥 Detection is inside your alert radius!"

        )


# ============================================================
# GENERAL NASA DATA INFORMATION
# ============================================================

print(
    "\n📊 NASA DATA"
)


print(

    "Number of detections:",

    len(data)

)


print(

    "Satellites collected:",

    ", ".join(FIRMS_SOURCES)

)


print(
    "\nColumns:"
)


print(
    data.columns.tolist()
)


print(
    "\nFirst 5 detections:"
)


print(
    data.head()
)


# ============================================================
# PRINT FIRST 10 DETECTIONS
# ============================================================

print(
    "\n🔎 FIRST 10 DETECTIONS"
)


for index, fire in data.head(10).iterrows():

    print()

    print(

        "Detection:",

        index + 1

    )


    print(

        "Latitude:",

        fire["latitude"]

    )


    print(

        "Longitude:",

        fire["longitude"]

    )


    print(

        "Date:",

        fire["acq_date"]

    )


    print(

        "Time:",

        fire["acq_time"]

    )


    print(

        "Satellite:",

        fire["satellite"]

    )


    print(

        "Confidence:",

        fire["confidence"]

    )


    print(

        "FRP:",

        fire["frp"]

    )