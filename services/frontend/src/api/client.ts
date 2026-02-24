import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 300000, // 5 minutes timeout for predictions (they can take 30-60 seconds)
});

export default api;


