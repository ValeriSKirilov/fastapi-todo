const development = "http://127.0.0.1:8000"
const production = "http://127.0.0.1:8000" //TODO DEPLOY AND FINISH

const isLocalHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

export const API_BASE_URL = isLocalHost ? development : production;