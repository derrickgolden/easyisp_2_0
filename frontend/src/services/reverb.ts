import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

window.Pusher = Pusher;

const wsHost = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
const wsPort = Number(import.meta.env.VITE_REVERB_PORT || 8080);
const wsScheme = import.meta.env.VITE_REVERB_SCHEME || 'http';
const appKey = import.meta.env.VITE_REVERB_APP_KEY || import.meta.env.VITE_PUSHER_APP_KEY || '';
const cluster = import.meta.env.VITE_REVERB_CLUSTER || import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1';
const wsEnabled = String(import.meta.env.VITE_REVERB_ENABLED || '').toLowerCase() === 'true';

export const reverbEcho = wsEnabled && appKey
  ? new Echo({
      broadcaster: 'pusher',
      key: appKey,
      cluster,
      wsHost,
      wsPort,
      wssPort: wsPort,
      forceTLS: wsScheme === 'https',
      enabledTransports: ['ws', 'wss'],
    })
  : null;

export default reverbEcho;
