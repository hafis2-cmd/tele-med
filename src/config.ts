const API_BASE_URL = import.meta.env.PROD 
  ? "https://api.healthline.com"  // Your cloud hosted backend URL
  : "http://localhost:3000";     // Local dev server

export default API_BASE_URL;
