import Echo from "laravel-echo";
import Pusher from "pusher-js";

window.Pusher = Pusher;

const wsScheme =
    import.meta.env.VITE_REVERB_SCHEME ||
    (window.location.protocol === "https:" ? "https" : "http");
const isTls = wsScheme === "https";
const wsHost = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
const wsPort = Number(import.meta.env.VITE_REVERB_PORT || (isTls ? 443 : 80));

const echo = new Echo({
    broadcaster: "reverb",
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: isTls,
    disableStats: true,
    enabledTransports: isTls ? ["wss"] : ["ws"],
});

window.Echo = echo;

export default echo;