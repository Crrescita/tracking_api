const axios = require("axios");

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

exports.getAddressFromLatLng = async (lat, lng) => {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;

    const response = await axios.get(url, {
      params: {
        access_token: MAPBOX_TOKEN,
        limit: 1,
      },
      timeout: 5000,
    });

    const feature = response.data?.features?.[0];
    return feature?.place_name || null;
  } catch (err) {
    console.error("Mapbox reverse geocoding failed:", err.message);
    return null; // never block API
  }
};
